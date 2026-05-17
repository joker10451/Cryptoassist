import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enrichProject } from '@/lib/enrichment/enrich'

/**
 * POST /api/projects/enrich-batch
 *   body: { dryRun?: boolean, limit?: number, slugs?: string[] }
 *
 * Прогоняет enrich по всем проектам (или по slugs если передан),
 * последовательно с задержкой ~3с между, чтобы уважать rate limits
 * CoinGecko (30 req/min) и GitHub (60 req/h без токена).
 *
 * Стримить мы не будем — отдадим summary одним JSON в конце.
 * Для длинного списка лучше дёргать UI пакетно по 10.
 */

const PER_PROJECT_DELAY_MS = 6500

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

interface BatchEntry {
  slug: string
  name: string
  updated: boolean
  patched_fields: string[]
  sources: { cg: boolean; dl: boolean; gh: string | null }
  notes: string[]
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const dryRun = !!body?.dryRun
    const limit = typeof body?.limit === 'number' ? Math.min(50, body.limit) : 50
    const slugs = Array.isArray(body?.slugs) ? (body.slugs as string[]) : null

    let projects: { id: string; slug: string; name: string }[] = []
    if (slugs && slugs.length > 0) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, slug, name, description, category, ecosystem, website_url, twitter_url, github_url, funding_amount, investors')
        .in('slug', slugs)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      projects = data ?? []
    } else {
      const { data, error } = await supabase
        .from('projects')
        .select('id, slug, name, description, category, ecosystem, website_url, twitter_url, github_url, funding_amount, investors')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      projects = data ?? []
    }

    const results: BatchEntry[] = []
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i] as typeof projects[number] & {
        description?: string | null
        category?: string | null
        ecosystem?: string | null
        website_url?: string | null
        twitter_url?: string | null
        github_url?: string | null
        funding_amount?: number | null
        investors?: string[] | null
      }
      try {
        const r = await enrichProject({
          slug: p.slug,
          name: p.name,
          existing: {
            description: p.description ?? null,
            category: p.category ?? null,
            ecosystem: p.ecosystem ?? null,
            website_url: p.website_url ?? null,
            twitter_url: p.twitter_url ?? null,
            github_url: p.github_url ?? null,
            funding_amount: p.funding_amount ?? null,
            investors: p.investors ?? null,
          },
        })

        let updated = false
        const patchKeys = Object.keys(r.patch)
        if (!dryRun && patchKeys.length > 0) {
          const { error: updErr } = await supabase
            .from('projects')
            .update(r.patch)
            .eq('id', p.id)
          if (updErr) {
            results.push({
              slug: p.slug,
              name: p.name,
              updated: false,
              patched_fields: patchKeys,
              sources: {
                cg: !!r.sources.coingecko,
                dl: !!r.sources.defillama,
                gh: r.sources.github ? `${r.sources.github.owner}/${r.sources.github.repo}` : null,
              },
              notes: r.notes,
              error: updErr.message,
            })
            continue
          }
          updated = true
        }

        results.push({
          slug: p.slug,
          name: p.name,
          updated,
          patched_fields: patchKeys,
          sources: {
            cg: !!r.sources.coingecko,
            dl: !!r.sources.defillama,
            gh: r.sources.github ? `${r.sources.github.owner}/${r.sources.github.repo}` : null,
          },
          notes: r.notes,
        })
      } catch (err) {
        results.push({
          slug: p.slug,
          name: p.name,
          updated: false,
          patched_fields: [],
          sources: { cg: false, dl: false, gh: null },
          notes: [],
          error: (err as Error).message,
        })
      }
      if (i < projects.length - 1) await sleep(PER_PROJECT_DELAY_MS)
    }

    return NextResponse.json({
      total: projects.length,
      updated_count: results.filter((r) => r.updated).length,
      results,
      dry_run: dryRun,
    })
  } catch (err) {
    console.error('[projects/enrich-batch]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
