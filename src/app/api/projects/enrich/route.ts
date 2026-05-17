import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { enrichProject } from '@/lib/enrichment/enrich'

/**
 * POST /api/projects/enrich
 *   body: { project_id?: string, slug?: string, dryRun?: boolean }
 *
 * Минимум один из project_id / slug. Ищет проект, дёргает CoinGecko + DefiLlama,
 * вписывает только пустые поля (description/category/ecosystem/website/twitter/funding/investors).
 *
 * Возвращает что нашли + что записали (или собирался записать, если dryRun=true).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const projectId = typeof body?.project_id === 'string' ? body.project_id : null
    const slug = typeof body?.slug === 'string' ? body.slug : null
    const dryRun = !!body?.dryRun

    if (!projectId && !slug) {
      return NextResponse.json(
        { error: 'project_id or slug required' },
        { status: 400 },
      )
    }

    const query = supabase
      .from('projects')
      .select(
        'id, slug, name, description, category, ecosystem, website_url, twitter_url, github_url, funding_amount, investors',
      )
      .limit(1)
    const { data, error } = projectId
      ? await query.eq('id', projectId).maybeSingle()
      : await query.eq('slug', slug as string).maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'project not found' }, { status: 404 })

    const result = await enrichProject({
      slug: data.slug,
      name: data.name,
      existing: {
        description: data.description,
        category: data.category,
        ecosystem: data.ecosystem,
        website_url: data.website_url,
        twitter_url: data.twitter_url,
        github_url: data.github_url,
        funding_amount: data.funding_amount,
        investors: data.investors,
      },
    })

    let updated = false
    const patchKeys = Object.keys(result.patch)
    if (!dryRun && patchKeys.length > 0) {
      const { error: updErr } = await supabase
        .from('projects')
        .update(result.patch)
        .eq('id', data.id)
      if (updErr) {
        return NextResponse.json(
          { error: `update failed: ${updErr.message}`, found: result },
          { status: 500 },
        )
      }
      updated = true
    }

    return NextResponse.json({
      project_id: data.id,
      slug: data.slug,
      name: data.name,
      sources_found: {
        coingecko: !!result.sources.coingecko,
        defillama: !!result.sources.defillama,
        raises_rounds: result.sources.raises_count,
        github: result.sources.github
          ? `${result.sources.github.owner}/${result.sources.github.repo}`
          : null,
        github_commits_30d: result.sources.github?.commits_30d ?? null,
      },
      patch: result.patch,
      patched_fields: patchKeys,
      scoring_inputs: result.scoring_inputs,
      notes: result.notes,
      dry_run: dryRun,
      updated,
    })
  } catch (err) {
    console.error('[projects/enrich]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
