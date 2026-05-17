import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    if (!data.version || !data.exportedAt) {
      return NextResponse.json({ error: 'Неверный формат файла' }, { status: 400 })
    }

    let imported = 0
    let errors = 0

    if (data.projects?.length) {
      const { error } = await supabase.from('projects').upsert(data.projects, { onConflict: 'slug' })
      if (error) errors++
      else imported += data.projects.length
    }

    if (data.tasks?.length) {
      const { error } = await supabase.from('tasks').upsert(data.tasks, { onConflict: 'id' })
      if (error) errors++
      else imported += data.tasks.length
    }

    if (data.wallets?.length) {
      const { error } = await supabase.from('wallets').upsert(data.wallets, { onConflict: 'id' })
      if (error) errors++
      else imported += data.wallets.length
    }

    if (data.reminders?.length) {
      const { error } = await supabase.from('reminders').upsert(data.reminders, { onConflict: 'id' })
      if (error) errors++
      else imported += data.reminders.length
    }

    return NextResponse.json({ success: true, imported, errors })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Ошибка импорта' }, { status: 500 })
  }
}
