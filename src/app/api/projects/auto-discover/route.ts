import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enrichProject } from '@/lib/enrichment/enrich'
import { scoreProject } from '@/lib/scoring/engine'
import { getActiveWeights, getHotNarratives } from '@/lib/scoring/state'
import type { TokenStatus } from '@/lib/scoring/types'

/**
 * POST /api/projects/auto-discover
 *
 * Полный pipeline «найти → обогатить → пересчитать»:
 *  1. Тянем активные проекты из AlphaDrops (как /api/projects/discover-referrals)
 *  2. Для новых добавленных — синхронно прогоняем enrichProject (CoinGecko + DefiLlama + GitHub + DropsTab),
 *     с задержкой между, чтобы не упереться в rate limits.
 *  3. Считаем v2 score (без AI, дешёво) и сохраняем.
 *
 * Возвращаем сводку для UI.
 */

const ALPHADROPS_URL = 'https://alphadrops.net/api/airdrops?status=active&limit=50'
const ENRICH_DELAY_MS = 6500

interface AlphaProject {
  name: string
  slug: string
  categories: string[]
  blockchains: string[]
  shortDescription: string
  fundingAmount: string | null
  isFreeAccess: boolean
  hasPoints: boolean
  status: string
  website: string | null
  socialTwitter: string | null
  tasks: { title: string; description: string; link: string | null }[]
}

function mapCategory(cats: string[]): string {
  const all = cats.map((c) => c.toLowerCase())
  if (all.some((c) => c.includes('depin'))) return 'depin'
  if (all.some((c) => c.includes('l1') || c.includes('network'))) return 'layer1'
  if (all.some((c) => c.includes('l2'))) return 'layer2'
  if (all.some((c) => c.includes('defi') || c.includes('dex') || c.includes('perps'))) return 'defi'
  if (all.some((c) => c.includes('nft'))) return 'nft'
  if (all.some((c) => c.includes('gam'))) return 'gaming'
  if (all.some((c) => c.includes('ai'))) return 'infra'
  if (all.some((c) => c.includes('infra'))) return 'infra'
  return 'other'
}

function parseFunding(s: string | null): number | null {
  if (!s || s === 'NA' || s === 'TBA') return null
  const m = s.match(/\$([\d.]+)M/i)
  if (m) return Math.round(parseFloat(m[1]) * 1_000_000)
  const k = s.match(/\$([\d.]+)K/i)
  if (k) return Math.round(parseFloat(k[1]) * 1_000)
  return null
}

function mapTaskType(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('bridge')) return 'bridge'
  if (t.includes('swap') || t.includes('trade')) return 'swap'
  if (t.includes('stake') || t.includes('deposit')) return 'stake'
  if (t.includes('mint') || t.includes('nft')) return 'mint'
  if (t.includes('discord') || t.includes('community') || t.includes('join')) return 'social'
  if (t.includes('testnet') || t.includes('faucet')) return 'testnet'
  if (t.includes('quest') || t.includes('galxe') || t.includes('campaign')) return 'quest'
  return 'quest'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST() {
  try {
    const res = await fetch(ALPHADROPS_URL, { next: { revalidate: 0 } })
    if (!res.ok) {
      return NextResponse.json({ error: `AlphaDrops API: ${res.status}` }, { status: 502 })
    }

    const all = (await res.json()) as AlphaProject[]
    const candidates = all.filter(
      (p) => p.status === 'active' && (p.hasPoints || p.isFreeAccess),
    )

    let added = 0
    let existing = 0
    let tasksAdded = 0
    const newProjectIds: { id: string; slug: string; name: string }[] = []

    // 1. Discover & insert
    for (const p of candidates) {
      const slug = p.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
      const category = mapCategory(p.categories)
      const funding = parseFunding(p.fundingAmount)
      const ecosystem = (p.blockchains?.[0] ?? 'multi').toLowerCase()

      const { data: ex } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (ex) {
        existing++
        continue
      }

      const { data: created, error: insErr } = await supabase
        .from('projects')
        .insert({
          slug,
          name: p.name,
          category,
          ecosystem,
          description: p.shortDescription || null,
          token_status: 'no_token',
          probability_score: p.hasPoints ? 65 : 55,
          farming_difficulty: 3,
          risk_score: 3,
          farming_cost: 0,
          funding_amount: funding,
          website_url: p.website || null,
          twitter_url: p.socialTwitter || null,
          status: 'active',
          snapshot_status: 'unknown',
        })
        .select('id, slug, name')
        .single()

      if (insErr || !created) continue
      added++
      newProjectIds.push(created)

      if (p.tasks.length > 0) {
        const taskRows = p.tasks.map((t) => ({
          project_id: created.id,
          title: t.title,
          description: t.description || null,
          task_type: mapTaskType(t.title),
          difficulty: 3,
          url: t.link || p.website || null,
          status: 'pending',
          requirement_type: 'quest',
        }))
        const { data: insertedTasks } = await supabase
          .from('tasks')
          .insert(taskRows)
          .select('id')
        tasksAdded += insertedTasks?.length ?? 0
      }
    }

    // 2. Enrich + rescore (только новые, чтобы не съесть весь rate-limit)
    const [weights, hot] = await Promise.all([getActiveWeights(), getHotNarratives()])
    const enrichResults: { slug: string; updated: boolean; score?: number; error?: string }[] = []

    for (let i = 0; i < newProjectIds.length; i++) {
      const np = newProjectIds[i]
      try {
        const { data: row } = await supabase
          .from('projects')
          .select('id, slug, name, description, category, ecosystem, website_url, twitter_url, github_url, funding_amount, investors, token_status, farming_cost')
          .eq('id', np.id)
          .single()

        if (!row) continue

        const r = await enrichProject({
          slug: row.slug,
          name: row.name,
          existing: {
            description: row.description,
            category: row.category,
            ecosystem: row.ecosystem,
            website_url: row.website_url,
            twitter_url: row.twitter_url,
            github_url: row.github_url,
            funding_amount: row.funding_amount,
            investors: row.investors,
          },
        })

        const patchKeys = Object.keys(r.patch)
        if (patchKeys.length > 0) {
          await supabase.from('projects').update(r.patch).eq('id', row.id)
        }

        // Перечитываем актуальные данные после enrichment (чтобы funding/investors были свежие)
        const { data: fresh } = await supabase
          .from('projects')
          .select('token_status, funding_amount, investors, farming_cost')
          .eq('id', row.id)
          .single()

        const breakdown = scoreProject(
          {
            token_status: ((fresh?.token_status as TokenStatus | null) ?? 'no_token') ?? undefined,
            funding_amount: fresh?.funding_amount ?? row.funding_amount ?? undefined,
            investors: fresh?.investors ?? row.investors ?? undefined,
            farming_cost_usd: fresh?.farming_cost ?? row.farming_cost ?? undefined,
            testnet_active: (fresh?.token_status ?? row.token_status) === 'no_token',
            has_product: true,
          },
          { weights, hotNarratives: hot },
        )

        await supabase
          .from('projects')
          .update({ probability_score: breakdown.final_score })
          .eq('id', row.id)

        enrichResults.push({ slug: row.slug, updated: patchKeys.length > 0, score: breakdown.final_score })
      } catch (err) {
        enrichResults.push({ slug: np.slug, updated: false, error: (err as Error).message })
      }

      if (i < newProjectIds.length - 1) await sleep(ENRICH_DELAY_MS)
    }

    return NextResponse.json({
      success: true,
      total_candidates: candidates.length,
      added,
      existing,
      tasks_added: tasksAdded,
      enriched: enrichResults,
    })
  } catch (error) {
    console.error('[projects/auto-discover]', error)
    return NextResponse.json({ error: 'Ошибка авто-обнаружения' }, { status: 500 })
  }
}
