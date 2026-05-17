import { NextResponse } from 'next/server'
import { getTasks } from '@/lib/supabase'

export async function GET() {
  try {
    const tasks = await getTasks()
    return NextResponse.json({ tasks, count: tasks.length })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ error: 'Ошибка получения задач' }, { status: 500 })
  }
}
