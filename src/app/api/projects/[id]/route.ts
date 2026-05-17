import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const allowed: { snapshot_date?: string | null; snapshot_status?: string; deadline?: string | null } = {}

    if ('snapshot_date' in body) {
      const v = body.snapshot_date
      if (v === null || v === '') {
        allowed.snapshot_date = null
      } else if (typeof v === 'string' && !isNaN(Date.parse(v))) {
        allowed.snapshot_date = new Date(v).toISOString()
      } else {
        return NextResponse.json({ error: 'Невалидная snapshot_date' }, { status: 400 })
      }
    }

    if ('snapshot_status' in body) {
      const v = body.snapshot_status
      if (typeof v === 'string' && ['unknown', 'upcoming', 'active', 'passed'].includes(v)) {
        allowed.snapshot_status = v
      }
    }

    if ('deadline' in body) {
      const v = body.deadline
      if (v === null || v === '') {
        allowed.deadline = null
      } else if (typeof v === 'string' && !isNaN(Date.parse(v))) {
        allowed.deadline = new Date(v).toISOString()
      } else {
        return NextResponse.json({ error: 'Невалидный deadline' }, { status: 400 })
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
    }

    const { data, error } = await supabase.from('projects').update(allowed).eq('id', id).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, project: data })
  } catch (error) {
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
