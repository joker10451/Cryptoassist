import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || 'default'

    const { data, error } = await supabase
      .from('user_tasks')
      .select('task_id, status, completed_at')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const statuses: Record<string, string> = {}
    data?.forEach((row: any) => {
      statuses[row.task_id] = row.status
    })

    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Get task statuses error:', error)
    return NextResponse.json({}, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { taskId, status, userId } = await req.json()

    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId и status обязательны' }, { status: 400 })
    }

    const uid = userId || 'default'

    const { data: existing } = await supabase
      .from('user_tasks')
      .select('id')
      .eq('user_id', uid)
      .eq('task_id', taskId)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('user_tasks')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('id', existing.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('user_tasks')
        .insert({
          user_id: uid,
          task_id: taskId,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          xp_reward: 10,
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update task status error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
