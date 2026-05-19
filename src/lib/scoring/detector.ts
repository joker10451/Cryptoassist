/**
 * AI Opportunity Detector.
 *
 * Берёт необработанные raw_signals, батчит и просит LLM извлечь:
 *   - название проекта
 *   - категорию
 *   - confidence (насколько уверены, что это новая farming-возможность)
 *
 * Затем агрегирует по slug, копит mentions/evidence,
 * upsert'ит в detected_opportunities.
 *
 * Важно: AI здесь только для извлечения. Никаких числовых score —
 * это работа scoreProject() при последующей конвертации в projects.
 */

import { supabase } from '@/lib/supabase'

const db = supabase

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

interface RawSignalRow {
  id: string
  source: string
  author: string | null
  content: string
  url: string | null
  collected_at: string
}

interface ExtractedProject {
  name: string
  slug: string
  category: string | null
  description: string | null
  confidence: number
  signal_index: number // индекс твита в батче (для evidence)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 20000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

const VALID_CATS = ['layer1', 'layer2', 'defi', 'infra', 'social', 'gaming', 'nft', 'other']

async function extractFromBatch(batch: RawSignalRow[]): Promise<ExtractedProject[]> {
  if (batch.length === 0 || !NVIDIA_API_KEY) return []

  const numbered = batch
    .map((s, i) => `[${i}] @${s.author ?? '?'}: ${s.content.replace(/\s+/g, ' ').slice(0, 280)}`)
    .join('\n')

  const prompt = `You analyze crypto Twitter/Discord posts and extract crypto PROJECTS that present a real farming/airdrop OPPORTUNITY.

Posts (numbered):
${numbered}

Rules:
- Only extract NAMED projects ($XYZ, @ProjectName, projectname.xyz). Ignore generic "airdrop hunting" advice.
- One post can mention multiple projects, that is OK.
- Multiple posts about the same project — return separately, we will dedupe by slug.
- "confidence" 0-100: how sure you are this is a real opportunity worth tracking.
  - 80+ : explicit testnet/airdrop with clear instructions
  - 50-79: project mentioned with some farming hint
  - <50 : casual mention, do not include
- "category" must be one of: layer1, layer2, defi, infra, social, gaming, nft, other
- "signal_index" — number from the [N] prefix of the post you extracted from
- Skip rumors, scams, screenshots without context.

Return ONLY JSON, no markdown:
{"projects":[{"name":"Monad","slug":"monad","category":"layer1","description":"short","confidence":85,"signal_index":3}]}`

  try {
    const r = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON. No commentary, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    })
    if (!r.ok) {
      console.warn('[detector] AI non-OK:', r.status)
      return []
    }
    const data = await r.json()
    const content: string = data.choices?.[0]?.message?.content || '{}'
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
    const m = clean.match(/\{[\s\S]*\}/)
    if (!m) return []
    const parsed = JSON.parse(m[0])
    const arr: unknown[] = Array.isArray(parsed.projects) ? parsed.projects : []

    const out: ExtractedProject[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      if (typeof p.name !== 'string' || typeof p.confidence !== 'number') continue

      const slug =
        typeof p.slug === 'string' && p.slug ? slugify(p.slug as string) : slugify(p.name)
      const category =
        typeof p.category === 'string' && VALID_CATS.includes(p.category) ? p.category : 'other'
      const sigIdx =
        typeof p.signal_index === 'number' &&
        p.signal_index >= 0 &&
        p.signal_index < batch.length
          ? Math.floor(p.signal_index)
          : 0
      const confidence = Math.max(0, Math.min(100, Math.round(p.confidence)))
      if (confidence < 50) continue

      out.push({
        name: String(p.name).trim().slice(0, 100),
        slug,
        category,
        description: typeof p.description === 'string' ? p.description.slice(0, 300) : null,
        confidence,
        signal_index: sigIdx,
      })
    }
    return out
  } catch (err) {
    console.warn('[detector] extract error:', err)
    return []
  }
}

interface AggKey {
  slug: string
  name: string
  category: string | null
  description: string | null
  max_confidence: number
  signal_ids: Set<string>
  authors: Set<string>
  urls: Set<string>
  samples: string[]
}

export interface DetectorRunResult {
  signals_processed: number
  batches: number
  candidates_extracted: number
  detected_upserted: number
  reason?: string
}

interface DetectorOptions {
  /** Сколько необработанных сигналов забирать максимум за один прогон. */
  limit?: number
  /** Сколько твитов в одной LLM-пачке. */
  batchSize?: number
  /** Брать только сигналы свежее этого момента (default: 48ч назад). */
  sinceMs?: number
}

export async function runDetector(opts: DetectorOptions = {}): Promise<DetectorRunResult> {
  const limit = opts.limit ?? 200
  const batchSize = opts.batchSize ?? 25
  const sinceCutoff = new Date(Date.now() - (opts.sinceMs ?? 48 * 3600 * 1000)).toISOString()

  if (!NVIDIA_API_KEY) {
    return {
      signals_processed: 0,
      batches: 0,
      candidates_extracted: 0,
      detected_upserted: 0,
      reason: 'NVIDIA_API_KEY missing',
    }
  }

  const { data: signalsRaw, error: signalsErr } = await db
    .from('raw_signals')
    .select('id, source, author, content, url, collected_at')
    .is('processed_at', null)
    .gte('collected_at', sinceCutoff)
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (signalsErr) {
    return {
      signals_processed: 0,
      batches: 0,
      candidates_extracted: 0,
      detected_upserted: 0,
      reason: `signals read: ${signalsErr.message}`,
    }
  }

  const signals = (signalsRaw as RawSignalRow[]) || []
  if (signals.length === 0) {
    return { signals_processed: 0, batches: 0, candidates_extracted: 0, detected_upserted: 0 }
  }

  const aggregate = new Map<string, AggKey>()
  let totalExtracted = 0
  let batchCount = 0

  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize)
    batchCount++
    const extracted = await extractFromBatch(batch)
    totalExtracted += extracted.length

    for (const p of extracted) {
      const sig = batch[p.signal_index]
      const key = p.slug
      const existing = aggregate.get(key)
      if (existing) {
        existing.max_confidence = Math.max(existing.max_confidence, p.confidence)
        if (!existing.description && p.description) existing.description = p.description
        if (sig) {
          existing.signal_ids.add(sig.id)
          if (sig.author) existing.authors.add(sig.author)
          if (sig.url) existing.urls.add(sig.url)
          if (existing.samples.length < 5) existing.samples.push(sig.content.slice(0, 200))
        }
      } else {
        aggregate.set(key, {
          slug: p.slug,
          name: p.name,
          category: p.category,
          description: p.description,
          max_confidence: p.confidence,
          signal_ids: sig ? new Set([sig.id]) : new Set(),
          authors: sig?.author ? new Set([sig.author]) : new Set(),
          urls: sig?.url ? new Set([sig.url]) : new Set(),
          samples: sig ? [sig.content.slice(0, 200)] : [],
        })
      }
    }
  }

  // Узнаём, какие slug уже есть в projects — чтобы не предлагать дубликаты в UI
  const slugs = Array.from(aggregate.keys())
  const { data: existingProjects } = await db
    .from('projects')
    .select('slug')
    .in('slug', slugs)

  const existingSet = new Set<string>(
    ((existingProjects as { slug: string }[]) || []).map((r) => r.slug),
  )

  // Берём то, что уже есть в detected_opportunities, чтобы аккуратно слить mentions/signal_ids
  const { data: existingDetected } = await db
    .from('detected_opportunities')
    .select('id, project_slug, mentions_count, signal_ids')
    .in('project_slug', slugs)

  const detectedMap = new Map<
    string,
    { id: string; mentions_count: number; signal_ids: string[] }
  >(
    ((existingDetected as { id: string; project_slug: string; mentions_count: number; signal_ids: string[] }[]) || []).map(
      (r) => [r.project_slug, { id: r.id, mentions_count: r.mentions_count, signal_ids: r.signal_ids || [] }],
    ),
  )

  const now = new Date().toISOString()
  const upserts = Array.from(aggregate.values())
    .filter((a) => !existingSet.has(a.slug)) // не предлагаем то, что уже в projects
    .map((a) => {
      const prior = detectedMap.get(a.slug)
      const mergedSignalIds = Array.from(
        new Set([...(prior?.signal_ids ?? []), ...a.signal_ids]),
      )
      return {
        project_name: a.name,
        project_slug: a.slug,
        description: a.description,
        category: a.category,
        confidence: a.max_confidence,
        mentions_count: (prior?.mentions_count ?? 0) + a.signal_ids.size,
        signal_ids: mergedSignalIds,
        evidence: {
          authors: Array.from(a.authors).slice(0, 10),
          urls: Array.from(a.urls).slice(0, 10),
          samples: a.samples,
        },
        last_seen: now,
      }
    })

  let upsertedCount = 0
  if (upserts.length > 0) {
    const { error: upsertErr, data: upserted } = await db
      .from('detected_opportunities')
      .upsert(upserts, { onConflict: 'project_slug' })
      .select('id')
    if (upsertErr) {
      console.warn('[detector] upsert error:', upsertErr.message)
    } else {
      upsertedCount = upserted?.length ?? upserts.length
    }
  }

  // Помечаем сигналы как обработанные
  const ids = signals.map((s) => s.id)
  await db.from('raw_signals').update({ processed_at: now }).in('id', ids)

  return {
    signals_processed: signals.length,
    batches: batchCount,
    candidates_extracted: totalExtracted,
    detected_upserted: upsertedCount,
  }
}
