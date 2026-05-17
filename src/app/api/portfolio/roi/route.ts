import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const COSTS_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней

export async function GET() {
  try {
    const [walletsRes, projectsRes] = await Promise.all([
      supabase.from('wallets').select('id, address, label'),
      supabase.from('projects').select('name, slug, estimated_reward_min, estimated_reward_max, status').eq('status', 'active'),
    ])

    const wallets = walletsRes.data || []
    const projects = projectsRes.data || []

    // Pull cached costs for each wallet (analysis_type='wallet_costs', key=`costs-{lowercased address}`)
    const cutoff = new Date(Date.now() - COSTS_TTL_MS).toISOString()
    const costsRows = await Promise.all(
      wallets.map(async (w) => {
        const cacheKey = `costs-${w.address.toLowerCase()}`
        const { data } = await supabase
          .from('ai_analyses')
          .select('output_data, created_at')
          .eq('analysis_type', 'wallet_costs')
          .eq('input_data->>cache_key', cacheKey)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { wallet: w, costs: data?.output_data as any | null, computedAt: data?.created_at as string | null }
      })
    )

    let totalCostUsd = 0
    let totalTxCount = 0
    let totalFailedCount = 0
    let walletsWithData = 0
    const perWallet: Array<{ address: string; label: string | null; totalUsd: number; txCount: number; computedAt: string | null }> = []

    for (const row of costsRows) {
      if (row.costs) {
        walletsWithData++
        totalCostUsd += row.costs.totalUsd || 0
        totalTxCount += row.costs.totalTxCount || 0
        totalFailedCount += row.costs.totalFailedCount || 0
      }
      perWallet.push({
        address: row.wallet.address,
        label: row.wallet.label,
        totalUsd: row.costs?.totalUsd || 0,
        txCount: row.costs?.totalTxCount || 0,
        computedAt: row.computedAt,
      })
    }

    const expectedRewardMin = projects.reduce((s, p) => s + Number(p.estimated_reward_min || 0), 0)
    const expectedRewardMax = projects.reduce((s, p) => s + Number(p.estimated_reward_max || 0), 0)

    const roiMin = totalCostUsd > 0 ? expectedRewardMin / totalCostUsd : null
    const roiMax = totalCostUsd > 0 ? expectedRewardMax / totalCostUsd : null

    return NextResponse.json({
      walletsTotal: wallets.length,
      walletsWithData,
      perWallet,
      totalCostUsd,
      totalTxCount,
      totalFailedCount,
      projectsActive: projects.length,
      expectedRewardMin,
      expectedRewardMax,
      roiMin,
      roiMax,
    })
  } catch (error) {
    console.error('Portfolio ROI error:', error)
    return NextResponse.json({ error: 'Ошибка расчёта ROI' }, { status: 500 })
  }
}
