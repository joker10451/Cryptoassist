import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Свежие таблицы ещё не сгенерированы в database.ts, поэтому работаем через any-cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * GET /api/scoring/outcomes
 *   Список последних 100 outcomes (для UI калибровки).
 */
export async function GET() {
  try {
    const { data, error } = await db
      .from('scoring_outcomes')
      .select(
        'id, project_id, project_name, score_predicted, classification_predicted, ' +
          'airdrop_happened, real_outcome_value_usd, user_farmed, ' +
          'predicted_at, resolved_at',
      )
      .order('predicted_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ outcomes: data || [] })
  } catch (err) {
    console.error('[outcomes GET]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * PATCH /api/scoring/outcomes
 *   body: { id, airdrop_happened?, real_outcome_value_usd?, user_farmed?, notes? }
 *   Закрывает исход — ставит resolved_at = now().
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, airdrop_happened, real_outcome_value_usd, user_farmed, notes } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const update: Record<string, unknown> = {
      resolved_at: new Date().toISOString(),
    }
    if (typeof airdrop_happened === 'boolean') update.airdrop_happened = airdrop_happened
    if (typeof real_outcome_value_usd === 'number')
      update.real_outcome_value_usd = real_outcome_value_usd
    if (typeof user_farmed === 'boolean') update.user_farmed = user_farmed
    if (typeof notes === 'string') update.notes = notes

    const { error } = await db.from('scoring_outcomes').update(update).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[outcomes PATCH]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
