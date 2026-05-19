import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { scoreProject } from '@/lib/scoring/engine'
import { getActiveWeights, getHotNarratives } from '@/lib/scoring/state'
import type { TokenStatus } from '@/lib/scoring/types'

/**
 * POST /api/projects/rescore-all
 *
 *   Пересчитывает probability_score для всех проектов через v2 движок,
 *   используя данные что уже в БД (funding, investors, token_status,
 *   farming_cost). БЕЗ AI-enrichment — это быстро (~1сек на 100 проектов).
 *
 *   Полезно вызывать после массового enrich.
 */
export async function POST() {
  try {
    const [weights, hot] = await Promise.all([getActiveWeights(), getHotNarratives()])

    const { data: projects, error } = await supabase
      .from('projects')
      .select(
        'id, slug, name, category, token_status, funding_amount, investors, farming_cost, probability_score',
      )
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let updated = 0
    const changes: { slug: string; old: number; new: number; delta: number }[] = []

    for (const p of projects ?? []) {
      const breakdown = scoreProject(
        {
          token_status: (p.token_status as TokenStatus | null) ?? undefined,
          funding_amount: p.funding_amount ?? undefined,
          investors: p.investors ?? undefined,
          farming_cost_usd: p.farming_cost ?? undefined,
          // Эвристика: для свежих проектов без токена считаем что testnet активен.
          testnet_active: p.token_status === 'no_token',
          has_product: true,
        },
        { weights, hotNarratives: hot },
      )

      const oldScore = p.probability_score ?? 0
      const newScore = breakdown.final_score
      if (newScore !== oldScore) {
        const { error: updErr } = await supabase
          .from('projects')
          .update({ probability_score: newScore })
          .eq('id', p.id)
        if (!updErr) {
          updated++
          changes.push({ slug: p.slug, old: oldScore, new: newScore, delta: newScore - oldScore })
        }
      }
    }

    // Самые большие изменения
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    return NextResponse.json({
      total_projects: projects?.length ?? 0,
      updated,
      top_changes: changes.slice(0, 20),
    })
  } catch (err) {
    console.error('[projects/rescore-all]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
