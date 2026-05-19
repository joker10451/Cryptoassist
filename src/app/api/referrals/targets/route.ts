import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * GET /api/referrals/targets
 *   Список reply-targets с today's checkin status.
 */
export async function GET() {
  const today = new Date().toISOString().slice(0, 10)

  const { data: targets, error } = await db
    .from('reply_targets')
    .select('id, handle, display_name, tier, category, notes, active, last_replied_at, total_replies')
    .eq('active', true)
    .order('tier', { ascending: true })
    .order('total_replies', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: checkins } = await db
    .from('reply_checkins')
    .select('target_id')
    .eq('replied_at', today)

  const checkedSet = new Set<string>(
    ((checkins as { target_id: string }[]) || []).map((c) => c.target_id),
  )

  const enriched = ((targets as unknown[]) || []).map((t: unknown) => {
    const target = t as {
      id: string
      handle: string
      display_name: string | null
      tier: number
      category: string | null
      notes: string | null
      total_replies: number
      last_replied_at: string | null
    }
    return { ...target, replied_today: checkedSet.has(target.id) }
  })

  // Stats
  const totalToday = checkedSet.size
  const { data: weekData } = await db
    .from('reply_checkins')
    .select('id')
    .gte('replied_at', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  const totalWeek = (weekData as unknown[])?.length ?? 0

  return NextResponse.json({ targets: enriched, stats: { today: totalToday, week: totalWeek } })
}

/**
 * POST /api/referrals/targets
 *   body: { handle, display_name?, tier?, category?, notes? }
 *   Добавить новый target.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const handle = typeof body?.handle === 'string' ? body.handle.replace(/^@/, '').trim() : ''
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 })

  const { data, error } = await db
    .from('reply_targets')
    .upsert(
      {
        handle,
        display_name: body.display_name || null,
        tier: typeof body.tier === 'number' ? body.tier : 2,
        category: body.category || 'crypto',
        notes: body.notes || null,
        active: true,
      },
      { onConflict: 'handle' },
    )
    .select('id, handle')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, target: data })
}

/**
 * PATCH /api/referrals/targets
 *   body: { id, action: 'checkin' | 'remove' }
 *   checkin = записать reply_checkins на сегодня + инкремент total_replies.
 *   remove = деактивировать target.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, action } = body as { id?: string; action?: 'checkin' | 'remove' }
  if (!id || (action !== 'checkin' && action !== 'remove')) {
    return NextResponse.json({ error: 'id + action(checkin|remove) required' }, { status: 400 })
  }

  if (action === 'remove') {
    await db.from('reply_targets').update({ active: false }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // checkin
  const today = new Date().toISOString().slice(0, 10)
  const { error: insErr } = await db
    .from('reply_checkins')
    .upsert({ target_id: id, replied_at: today }, { onConflict: 'target_id,replied_at' })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // increment total + update last_replied_at
  const { data: target } = await db
    .from('reply_targets')
    .select('total_replies')
    .eq('id', id)
    .single()
  const prev = (target as { total_replies: number } | null)?.total_replies ?? 0
  await db
    .from('reply_targets')
    .update({ total_replies: prev + 1, last_replied_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
