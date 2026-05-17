import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ALERT_DAYS = [7, 3, 1]

export async function POST() {
  try {
    const now = new Date()

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name, snapshot_date, deadline')
      .eq('status', 'active')

    if (projErr) {
      return NextResponse.json({ error: projErr.message }, { status: 500 })
    }

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const p of projects || []) {
      const targets: { kind: 'snapshot' | 'deadline'; date: Date }[] = []
      if (p.snapshot_date) targets.push({ kind: 'snapshot', date: new Date(p.snapshot_date) })
      if (p.deadline) targets.push({ kind: 'deadline', date: new Date(p.deadline) })

      for (const target of targets) {
        if (target.date.getTime() < now.getTime()) continue // прошедшие даты

        for (const days of ALERT_DAYS) {
          const scheduledAt = new Date(target.date.getTime() - days * 86400000)
          if (scheduledAt.getTime() < now.getTime()) continue

          const title =
            target.kind === 'snapshot'
              ? `${p.name}: snapshot через ${days} ${days === 1 ? 'день' : 'дн'}`
              : `${p.name}: дедлайн через ${days} ${days === 1 ? 'день' : 'дн'}`

          // Проверка дубликата: тот же project_id + type + scheduled_at (с точностью до минуты)
          const windowMs = 60_000
          const fromIso = new Date(scheduledAt.getTime() - windowMs).toISOString()
          const toIso = new Date(scheduledAt.getTime() + windowMs).toISOString()

          const { data: existing } = await supabase
            .from('reminders')
            .select('id')
            .eq('project_id', p.id)
            .eq('type', target.kind)
            .gte('scheduled_at', fromIso)
            .lte('scheduled_at', toIso)
            .limit(1)

          if (existing && existing.length > 0) {
            skipped++
            continue
          }

          const { error: insErr } = await supabase.from('reminders').insert({
            user_id: null,
            project_id: p.id,
            type: target.kind,
            title,
            message: `Дата: ${target.date.toISOString().slice(0, 10)}`,
            scheduled_at: scheduledAt.toISOString(),
            channel: 'in_app',
          })

          if (insErr) {
            errors.push(`${p.name} (-${days}d): ${insErr.message}`)
          } else {
            created++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      errors,
      projectsScanned: projects?.length || 0,
    })
  } catch (error) {
    console.error('Generate snapshot alerts error:', error)
    return NextResponse.json({ error: 'Ошибка генерации алертов' }, { status: 500 })
  }
}
