import { NextRequest, NextResponse } from 'next/server'
import { getReminders, createReminder, deleteReminder, completeReminder } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'default'
    const reminders = await getReminders(userId)
    return NextResponse.json(reminders)
  } catch (error) {
    console.error('GET reminders error:', error)
    return NextResponse.json({ error: 'Ошибка получения напоминаний' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId || 'default'
    
    if (!body.title || !body.scheduled_at) {
      return NextResponse.json({ error: 'Название и дата обязательны' }, { status: 400 })
    }

    const reminder = await createReminder({
      title: body.title,
      message: body.message,
      type: body.type || 'custom',
      scheduled_at: body.scheduled_at,
      project: body.project,
      channel: body.channel || 'in_app',
      is_recurring: body.is_recurring || false,
      recurrence_rule: body.recurrence_rule,
    }, userId)

    if (!reminder) {
      return NextResponse.json({ error: 'Ошибка создания напоминания' }, { status: 500 })
    }

    return NextResponse.json({ success: true, reminder })
  } catch (error) {
    console.error('POST reminders error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId') || 'default'
    const action = searchParams.get('action')

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    let success
    if (action === 'complete') {
      success = await completeReminder(id, userId)
    } else {
      success = await deleteReminder(id, userId)
    }

    if (!success) {
      return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE reminders error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
