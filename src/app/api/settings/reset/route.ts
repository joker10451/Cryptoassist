import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    const tables = ['reminders', 'wallets', 'user_tasks', 'user_projects', 'user_achievements', 'ai_analyses', 'missed_opportunities'] as const

    let deleted = 0
    let errors = 0

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) errors++
      else deleted++
    }

    return NextResponse.json({ success: true, deleted, errors })
  } catch (error) {
    console.error('Reset error:', error)
    return NextResponse.json({ error: 'Ошибка сброса' }, { status: 500 })
  }
}
