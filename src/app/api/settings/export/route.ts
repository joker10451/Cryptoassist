import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const [projects, tasks, achievements, wallets, reminders] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('achievements').select('*'),
      supabase.from('wallets').select('*'),
      supabase.from('reminders').select('*'),
    ])

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      projects: projects.data || [],
      tasks: tasks.data || [],
      achievements: achievements.data || [],
      wallets: wallets.data || [],
      reminders: reminders.data || [],
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 })
  }
}
