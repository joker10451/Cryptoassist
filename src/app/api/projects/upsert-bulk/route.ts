import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface IncomingTask {
  title: string
  task_type: string
  description: string | null
  difficulty: number
  deadline: string | null
}

interface IncomingProject {
  name: string
  slug: string
  category: string
  description: string | null
  website_url: string | null
  twitter_url: string | null
  tasks: IncomingTask[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const projects: IncomingProject[] = Array.isArray(body?.projects) ? body.projects : []

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Нет проектов для сохранения' }, { status: 400 })
    }

    let projectsCreated = 0
    let projectsExisting = 0
    let tasksCreated = 0
    const errors: string[] = []

    for (const p of projects) {
      try {
        // Check if project exists by slug
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('slug', p.slug)
          .maybeSingle()

        let projectId: string

        if (existing) {
          projectId = existing.id
          projectsExisting++
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('projects')
            .insert({
              name: p.name,
              slug: p.slug,
              category: p.category,
              description: p.description,
              website_url: p.website_url,
              twitter_url: p.twitter_url,
              probability_score: 50,
              status: 'active',
            })
            .select('id')
            .single()

          if (insertErr || !inserted) {
            errors.push(`${p.name}: ${insertErr?.message || 'insert failed'}`)
            continue
          }
          projectId = inserted.id
          projectsCreated++
        }

        // Insert tasks (skip duplicates by title within the project)
        if (p.tasks.length > 0) {
          const { data: existingTasks } = await supabase
            .from('tasks')
            .select('title')
            .eq('project_id', projectId)

          const existingTitles = new Set((existingTasks || []).map((t) => t.title.toLowerCase()))

          const newTasks = p.tasks
            .filter((t) => !existingTitles.has(t.title.toLowerCase()))
            .map((t) => ({
              project_id: projectId,
              title: t.title,
              task_type: t.task_type,
              description: t.description,
              difficulty: t.difficulty,
              deadline: t.deadline,
              status: 'pending',
            }))

          if (newTasks.length > 0) {
            const { data: insertedTasks, error: tasksErr } = await supabase
              .from('tasks')
              .insert(newTasks)
              .select('id')

            if (tasksErr) {
              errors.push(`${p.name} tasks: ${tasksErr.message}`)
            } else {
              tasksCreated += insertedTasks?.length || 0
            }
          }
        }
      } catch (e: any) {
        errors.push(`${p.name}: ${e?.message || 'unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      projectsCreated,
      projectsExisting,
      tasksCreated,
      errors,
    })
  } catch (error) {
    console.error('Upsert bulk error:', error)
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
  }
}
