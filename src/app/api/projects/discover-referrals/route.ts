import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/projects/discover-referrals
 *
 * Тянет активные проекты из AlphaDrops API (бесплатно, без ключа),
 * фильтрует по hasPoints=true или isFreeAccess=true,
 * upsert'ит в нашу БД с задачами.
 */

const ALPHADROPS_URL = 'https://alphadrops.net/api/airdrops?status=active&limit=50'

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
        .select('id')
        .single()

      if (insErr || !created) continue
      added++

      // Добавляем задачи
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

    return NextResponse.json({
      success: true,
      total_candidates: candidates.length,
      added,
      existing,
      tasks_added: tasksAdded,
    })
  } catch (err) {
    console.error('[discover-referrals]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
