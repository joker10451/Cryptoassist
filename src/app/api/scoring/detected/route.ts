import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const db = supabase

/**
 * Slug-нормализация: режем известные суффиксы (xyz, io, finance, network, l2 и т.д.).
 * Если "hyperlane-xyz" → "hyperlane", матчится с существующим проектом.
 */
function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/-(xyz|io|finance|protocol|network|labs|l1|l2|fi|app|com|org)$/g, '')
    .replace(/-+$/g, '')
}

/**
 * GET /api/scoring/detected?status=pending
 *   Список кандидатов от детектора. По умолчанию pending, сортировка по confidence DESC.
 */
export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get('status') ?? 'pending'
  try {
    const { data, error } = await db
      .from('detected_opportunities')
      .select(
        'id, project_name, project_slug, description, category, confidence, mentions_count, evidence, status, first_seen, last_seen, reviewed_at, created_project_id',
      )
      .eq('status', status)
      .order('confidence', { ascending: false })
      .order('last_seen', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ detected: data || [] })
  } catch (err) {
    console.error('[detected GET]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * PATCH /api/scoring/detected
 *   body: { id, action: 'approve' | 'reject' }
 *   approve → создаёт запись в projects и сохраняет ссылку.
 *   reject  → помечает rejected.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action } = body as { id?: string; action?: 'approve' | 'reject' }
    if (!id || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'id + action(approve|reject) required' }, { status: 400 })
    }

    const { data: row, error: readErr } = await db
      .from('detected_opportunities')
      .select('id, project_name, project_slug, description, category, status, created_project_id')
      .eq('id', id)
      .maybeSingle()
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

    if (action === 'reject') {
      const { error } = await db
        .from('detected_opportunities')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'reject' })
    }

    // approve: создаём проект, если ещё нет
    let projectId: string | null = row.created_project_id
    if (!projectId) {
      // 1. Точное совпадение по slug
      const { data: existingBySlug } = await db
        .from('projects')
        .select('id')
        .eq('slug', row.project_slug)
        .maybeSingle()

      if (existingBySlug?.id) {
        projectId = existingBySlug.id
      } else {
        // 2. По нормализованному slug — например hyperlane-xyz → hyperlane
        const normalized = normalizeSlug(row.project_slug)
        if (normalized && normalized !== row.project_slug) {
          const { data: existingNormalized } = await db
            .from('projects')
            .select('id')
            .eq('slug', normalized)
            .maybeSingle()
          if (existingNormalized?.id) projectId = existingNormalized.id
        }
      }

      if (!projectId) {
        const { data: created, error: createErr } = await db
          .from('projects')
          .insert({
            slug: normalizeSlug(row.project_slug),
            name: row.project_name,
            description: row.description,
            category: row.category ?? 'other',
            token_status: 'no_token',
            probability_score: 50,
            status: 'active',
          })
          .select('id')
          .single()
        if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
        projectId = created?.id ?? null
      }
    }

    const { error: updErr } = await db
      .from('detected_opportunities')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        created_project_id: projectId,
      })
      .eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, action: 'approve', project_id: projectId })
  } catch (err) {
    console.error('[detected PATCH]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
