import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const updates = await req.json()

    const updateData: {
      status?: string
      completed_at?: string
      title?: string
      description?: string
    } = {}
    if (updates.status) updateData.status = updates.status
    if (updates.completed_at) updateData.completed_at = updates.completed_at
    if (updates.title) updateData.title = updates.title
    if (updates.description) updateData.description = updates.description

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Update task error:', error)
      if (error.code === '42703') {
        // Column doesn't exist - try with just completed_at
        if (updates.completed_at) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('tasks')
            .update({ completed_at: updates.completed_at })
            .eq('id', id)
            .select()

          if (fallbackError) {
            return NextResponse.json({ error: fallbackError.message }, { status: 500 })
          }
          return NextResponse.json({ success: true, task: fallbackData?.[0] })
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, task: data?.[0] })
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
