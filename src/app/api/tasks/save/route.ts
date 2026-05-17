import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { project_id, tasks } = await req.json()

    if (!project_id || !tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'project_id и tasks обязательны' }, { status: 400 })
    }

    const inserts = tasks.map((t: any) => ({
      project_id,
      title: t.title,
      description: t.description || null,
      task_type: t.type || 'social',
      requirement_type: t.requirement_type || 'quest',
      difficulty: Math.min(5, Math.max(1, t.difficulty || 3)),
      deadline: t.deadline || null,
    }))

    const { data, error } = await supabase
      .from('tasks')
      .insert(inserts)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      saved: data?.length || 0,
      tasks: data || [],
    })
  } catch (error) {
    console.error('Save tasks error:', error)
    return NextResponse.json({ error: 'Ошибка сохранения задач' }, { status: 500 })
  }
}
