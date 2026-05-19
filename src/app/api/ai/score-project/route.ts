import { NextRequest, NextResponse } from 'next/server'
import { getCachedAnalysis, saveCachedAnalysis, hashKey } from '@/lib/aiCache'
import { scoreProject } from '@/lib/scoring/engine'
import { getActiveWeights, getHotNarratives } from '@/lib/scoring/state'
import type { ScoringInputs } from '@/lib/scoring/types'
import { supabase } from '@/lib/supabase'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const CACHE_TTL = 10 * 60 * 1000

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 12000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch {
    clearTimeout(id)
    throw new Error('Timeout')
  }
}

interface ScoreRequest extends ScoringInputs {
  name: string
  category?: string
  description?: string | null
  chains?: string[] | null
  tvl?: number | null
  signals?: string[] | null
  /** Если true — пропустить AI enrichment (только числа, быстро). */
  skipAi?: boolean
  /** Если есть — записать в scoring_outcomes с этим project_id. */
  projectId?: string | null
}

interface AiEnrichment {
  alpha_summary: string
  what_to_do_next: string[]
  red_flags: string[]
  detected_narratives: string[]
}

const EMPTY_ENRICHMENT: AiEnrichment = {
  alpha_summary: '',
  what_to_do_next: [],
  red_flags: [],
  detected_narratives: [],
}

async function aiEnrich(body: ScoreRequest, score: number): Promise<AiEnrichment> {
  if (!NVIDIA_API_KEY) return EMPTY_ENRICHMENT

  const prompt = `You are a crypto research analyst. The numeric score is ALREADY computed.
Project: ${body.name}
Category: ${body.category || 'unknown'}
Token status: ${body.token_status || 'unknown'}
Funding: ${body.funding_amount ? `$${body.funding_amount}` : 'unknown'}
Investors: ${(body.investors || []).join(', ') || 'unknown'}
Description: ${body.description || 'n/a'}
Chains: ${(body.chains || []).join(', ') || 'unknown'}
TVL: ${body.tvl ? `$${body.tvl}` : 'unknown'}
Recent signals: ${(body.signals || []).join(' | ') || 'none'}
Computed score: ${score}/100

Produce ONLY JSON:
{
  "alpha_summary": "1-2 sentences in Russian, what makes this project notable now",
  "what_to_do_next": ["2-4 concrete farming actions"],
  "red_flags": ["any concerns, empty if none"],
  "detected_narratives": ["short tags like 'L2', 'Restaking', 'AI', 'Modular'"]
}`

  try {
    const response = await fetchWithTimeout(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [
            {
              role: 'system',
              content: 'You return ONLY valid JSON. No markdown, no commentary.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 384,
        }),
      },
    )

    if (!response.ok) return EMPTY_ENRICHMENT
    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || '{}'
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
    const m = clean.match(/\{[\s\S]*\}/)
    if (!m) return EMPTY_ENRICHMENT
    const parsed = JSON.parse(m[0])
    return {
      alpha_summary: typeof parsed.alpha_summary === 'string' ? parsed.alpha_summary : '',
      what_to_do_next: Array.isArray(parsed.what_to_do_next) ? parsed.what_to_do_next : [],
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      detected_narratives: Array.isArray(parsed.detected_narratives)
        ? parsed.detected_narratives
        : [],
    }
  } catch (err) {
    console.warn('[score-project] AI enrich failed:', err)
    return EMPTY_ENRICHMENT
  }
}

/**
 * Эвристика ожидаемой награды.
 *
 * Базируется на:
 *  - score (нормализован к множителю 0.4–1.6)
 *  - token_status (no_token = большая премия, launched = низкая или 0)
 *  - funding_amount (грубая корреляция с FDV → размер дропа)
 *
 * Цифры — это эмпирическая аппроксимация по последним L2-эирдропам
 * (Arbitrum/Optimism/zkSync/Starknet/Scroll), не точное предсказание.
 */
function rewardBaseUsd(funding: number | null | undefined): { min: number; max: number } {
  if (!funding || funding <= 0) return { min: 50, max: 500 }
  if (funding >= 200_000_000) return { min: 800, max: 8000 }
  if (funding >= 100_000_000) return { min: 500, max: 5000 }
  if (funding >= 50_000_000) return { min: 300, max: 3000 }
  if (funding >= 20_000_000) return { min: 200, max: 2000 }
  if (funding >= 5_000_000) return { min: 120, max: 1200 }
  return { min: 60, max: 600 }
}

function rewardMultiplier(score: number, tokenStatus: ScoringInputs['token_status']): number {
  // 0.4 при score=0, 1.6 при score=100
  const base = 0.4 + (score / 100) * 1.2
  if (tokenStatus === 'launched') return base * 0.1
  if (tokenStatus === 'announced') return base * 0.5
  if (tokenStatus === 'rumored') return base * 0.9
  return base // no_token / null — полный множитель
}

function estimateRewardMin(body: ScoreRequest, score: number): number {
  const { min } = rewardBaseUsd(body.funding_amount)
  return Math.max(0, Math.round(min * rewardMultiplier(score, body.token_status)))
}

function estimateRewardMax(body: ScoreRequest, score: number): number {
  const { max } = rewardBaseUsd(body.funding_amount)
  return Math.max(0, Math.round(max * rewardMultiplier(score, body.token_status)))
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScoreRequest
    if (!body?.name) {
      return NextResponse.json({ error: 'Название проекта обязательно' }, { status: 400 })
    }

    const cacheKey = `score-v2-${hashKey(JSON.stringify(body))}`
    const cached = await getCachedAnalysis('score_project', cacheKey, CACHE_TTL)
    if (cached) return NextResponse.json(cached)

    const [weights, hot] = await Promise.all([getActiveWeights(), getHotNarratives()])
    const breakdown = scoreProject(body, { weights, hotNarratives: hot })

    // AI enrichment может смержить нарративы из текста
    const enrichment = body.skipAi
      ? EMPTY_ENRICHMENT
      : await aiEnrich(body, breakdown.final_score)

    // Если AI обнаружил нарративы — пересчитаем (опционально)
    let finalBreakdown = breakdown
    if (enrichment.detected_narratives.length > 0 && (body.narratives || []).length === 0) {
      finalBreakdown = scoreProject(
        { ...body, narratives: enrichment.detected_narratives },
        { weights, hotNarratives: hot },
      )
    }

    const result = {
      score: finalBreakdown.final_score,
      classification: finalBreakdown.classification,
      breakdown: {
        founding_quality: finalBreakdown.founding_quality,
        airdrop_likelihood: finalBreakdown.airdrop_likelihood,
        farming_accessibility: finalBreakdown.farming_accessibility,
        market_momentum: finalBreakdown.market_momentum,
        signal_freshness: finalBreakdown.signal_freshness,
        narrative_strength: finalBreakdown.narrative_strength,
        risk: finalBreakdown.risk,
      },
      reasons: finalBreakdown.reasons,
      missing_signals: finalBreakdown.missing_signals,
      weights: finalBreakdown.weights,
      alpha_summary: enrichment.alpha_summary,
      what_to_do_next: enrichment.what_to_do_next,
      red_flags: enrichment.red_flags,
      detected_narratives: enrichment.detected_narratives,
      // Совместимость со старым клиентом: ai/page.tsx ждёт probability/estimatedRewardMin/...
      probability: finalBreakdown.final_score,
      estimatedRewardMin: estimateRewardMin(body, finalBreakdown.final_score),
      estimatedRewardMax: estimateRewardMax(body, finalBreakdown.final_score),
      riskLevel: Math.round(finalBreakdown.risk / 10),
      popularity: finalBreakdown.market_momentum >= 60 ? 'high' : finalBreakdown.market_momentum >= 30 ? 'medium' : 'low',
      summary: enrichment.alpha_summary,
      recommendation: enrichment.what_to_do_next.join(' → '),
    }

    void saveCachedAnalysis('score_project', cacheKey, { name: body.name }, result)

    // Лог в outcomes — без resolved_at, чтобы потом можно было закрыть исход вручную.
    if (body.projectId) {
      void supabase
        .from('scoring_outcomes')
        .insert({
          project_id: body.projectId,
          project_name: body.name,
          score_predicted: finalBreakdown.final_score,
          classification_predicted: finalBreakdown.classification,
          breakdown: finalBreakdown as unknown as import('@/types/database').Json,
          weights_used: finalBreakdown.weights as unknown as import('@/types/database').Json,
        })
        .then(({ error }) => {
          if (error) console.warn('[score-project] outcomes log:', error.message)
        })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e?.name === 'AbortError') {
      return NextResponse.json({ error: 'Таймаут AI' }, { status: 504 })
    }
    console.error('Score error:', err)
    return NextResponse.json({ error: 'Ошибка скоринга' }, { status: 500 })
  }
}
