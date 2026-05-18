import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const db = supabase

/**
 * GET /api/referrals
 *   Список проектов с реф-ссылками (или без — для UI настройки).
 */
export async function GET() {
  const { data, error } = await db
    .from('projects')
    .select(
      'id, name, slug, category, token_status, probability_score, referral_url, referral_code, referral_notes',
    )
    .order('probability_score', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data || [] })
}

/**
 * PATCH /api/referrals
 *   body: { project_id, referral_url?, referral_code?, referral_notes? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { project_id, referral_url, referral_code, referral_notes } = body
    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 })
    }

    const update: { referral_url?: string | null; referral_code?: string | null; referral_notes?: string | null } = {}
    if (referral_url !== undefined) update.referral_url = referral_url || null
    if (referral_code !== undefined) update.referral_code = referral_code || null
    if (referral_notes !== undefined) update.referral_notes = referral_notes || null

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    const { error } = await db.from('projects').update(update).eq('id', project_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[referrals PATCH]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
