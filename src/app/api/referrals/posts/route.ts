import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderTemplate, TEMPLATES, type TemplateId, twitterLength } from '@/lib/referrals/templates'

const db = supabase

/**
 * GET /api/referrals/posts?status=draft
 *   Лента постов (черновики/опубликованные).
 */
export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get('status') ?? 'draft'
  const { data, error } = await db
    .from('referral_posts')
    .select('id, project_id, template, body, ref_url, status, scheduled_at, published_at, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data || [] })
}

/**
 * POST /api/referrals/posts
 *   body: {
 *     project_id, template_id,
 *     inputs: { project?, feature?, time?, result?, timeframe?, points? },
 *     status?: 'draft' | 'scheduled',
 *     scheduled_at?: ISO string
 *   }
 *   Рендерит шаблон с реф-ссылкой проекта и сохраняет.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      project_id,
      template_id,
      inputs = {},
      status = 'draft',
      scheduled_at = null,
    } = body as {
      project_id?: string
      template_id?: TemplateId
      inputs?: {
        project?: string
        feature?: string
        time?: string
        result?: string
        timeframe?: string
        points?: string[]
      }
      status?: 'draft' | 'scheduled'
      scheduled_at?: string | null
    }

    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    if (!template_id || !TEMPLATES.find((t) => t.id === template_id)) {
      return NextResponse.json({ error: 'invalid template_id' }, { status: 400 })
    }

    const { data: project, error: projectErr } = await db
      .from('projects')
      .select('id, name, referral_url')
      .eq('id', project_id)
      .maybeSingle()

    if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 })
    if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })
    if (!project.referral_url) {
      return NextResponse.json(
        { error: 'project has no referral_url; set it in /referrals first' },
        { status: 400 },
      )
    }

    const rendered = renderTemplate(template_id, {
      project: inputs.project ?? project.name,
      feature: inputs.feature,
      time: inputs.time,
      result: inputs.result,
      timeframe: inputs.timeframe,
      points: inputs.points,
      ref: project.referral_url,
    })

    if (twitterLength(rendered) > 280 && template_id !== 'thread') {
      return NextResponse.json(
        { error: `Post too long: ${twitterLength(rendered)} chars (limit 280)`, body: rendered },
        { status: 400 },
      )
    }

    const { data: created, error: insErr } = await db
      .from('referral_posts')
      .insert({
        project_id,
        template: template_id,
        body: rendered,
        ref_url: project.referral_url,
        status,
        scheduled_at,
      })
      .select('id, body')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: created.id, body: created.body })
  } catch (err) {
    console.error('[referrals/posts POST]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * PATCH /api/referrals/posts
 *   body: { id, status?, body?, external_id?, published_at? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, body: text, external_id, published_at } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: { status?: string; body?: string; external_id?: string; published_at?: string } = {}
    if (status) update.status = status
    if (typeof text === 'string') update.body = text
    if (external_id) update.external_id = external_id
    if (published_at) update.published_at = published_at

    const { error } = await db.from('referral_posts').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[referrals/posts PATCH]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
