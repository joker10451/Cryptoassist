import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch {
    clearTimeout(id)
    throw new Error('Timeout')
  }
}

interface TaskWithProject {
  id: string
  title: string
  task_type: string
  difficulty: number
  deadline: string | null
  status: string
  project_id: string
  projects: { name: string; probability_score: number; estimated_reward_min: number; estimated_reward_max: number; token_status: string } | null
}

interface Project {
  id: string
  name: string
  probability_score: number
  estimated_reward_min: number
  estimated_reward_max: number
  token_status: string
  risk_score: number
  category: string
}

function calcPriorityScore(task: TaskWithProject): number {
  const project = task.projects
  if (!project) return 0

  const probWeight = project.probability_score / 100
  const avgReward = (project.estimated_reward_min + project.estimated_reward_max) / 2
  const rewardWeight = Math.min(avgReward / 2000, 1)
  const effortWeight = 1 - (task.difficulty - 1) / 4
  const urgencyWeight = task.deadline ? Math.max(0, 1 - (new Date(task.deadline).getTime() - Date.now()) / (24 * 3600 * 1000)) : 0.3
  const tokenBonus = project.token_status === 'no_token' ? 0.2 : 0

  return Math.round((probWeight * 0.3 + rewardWeight * 0.25 + effortWeight * 0.2 + urgencyWeight * 0.15 + tokenBonus * 0.1) * 100)
}

export async function GET() {
  try {
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*, projects(name, probability_score, estimated_reward_min, estimated_reward_max, token_status)')
      .order('difficulty', { ascending: true })

    if (tasksError) {
      console.error('Tasks fetch error:', tasksError)
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .order('probability_score', { ascending: false })

    const { data: wallets } = await supabase
      .from('wallets')
      .select('*')

    const typedTasks = (tasks || []) as TaskWithProject[]
    const typedProjects = (projects || []) as Project[]

    const scoredTasks = typedTasks.map(t => ({
      ...t,
      priority_score: calcPriorityScore(t),
      reward_range: {
        min: t.projects ? Math.round(t.projects.estimated_reward_min / typedTasks.length) : 0,
        max: t.projects ? Math.round(t.projects.estimated_reward_max / typedTasks.length) : 0,
      },
    }))

    scoredTasks.sort((a, b) => b.priority_score - a.priority_score)

    const topActions = scoredTasks.slice(0, 5)

    const urgentTasks = typedTasks
      .filter(t => t.deadline && new Date(t.deadline) < new Date(Date.now() + 24 * 3600 * 1000))
      .map(t => ({
        ...t,
        hours_left: t.deadline ? Math.round((new Date(t.deadline).getTime() - Date.now()) / 3600000) : null,
      }))
      .sort((a, b) => (a.hours_left || 999) - (b.hours_left || 999))
      .slice(0, 3)

    const topOpportunities = typedProjects
      .filter(p => p.token_status === 'no_token' || p.probability_score >= 60)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        probability: p.probability_score,
        reward_min: p.estimated_reward_min,
        reward_max: p.estimated_reward_max,
        category: p.category,
        token_status: p.token_status,
        score: p.probability_score,
        ai_category: p.probability_score >= 90 ? 'LEGENDARY_ALPHA' :
                     p.probability_score >= 75 ? 'HIGH_PRIORITY' :
                     p.probability_score >= 50 ? 'MEDIUM' :
                     p.probability_score >= 30 ? 'LOW' : 'NOISE',
      }))

    const completedTasks = typedTasks.filter(t => (t as any).status === 'completed' || (t as any).completed_at).length
    const totalTasks = typedTasks.length
    const pendingTasks = totalTasks - completedTasks

    const chainsCovered = new Set(wallets?.map(w => w.chain) || []).size
    const activeWallets = wallets?.length || 0

    let aiAdvice = ''
    try {
      const advicePrompt = `Ты — крипто-охотник. Проанализируй данные и дай ОДИН конкретный совет на сегодня.

Активные проекты: ${typedProjects.map(p => `${p.name} (${p.probability_score}%, ${p.token_status})`).join(', ')}
Ожидаемая награда: ${typedProjects.filter(p => p.estimated_reward_max).map(p => `${p.name}: $${p.estimated_reward_min}-${p.estimated_reward_max}`).join(', ')}
Задач осталось: ${pendingTasks}
Кошельков: ${wallets?.length || 0} (активных: ${activeWallets})
Цепей: ${chainsCovered}

Дай ОДИН короткий совет (1-2 предложения) на русском. Формат: "Сделай X потому что Y". Не более 150 символов.`

      const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [
            { role: 'system', content: 'Ты крипто-охотник. Даёшь короткие конкретные советы.' },
            { role: 'user', content: advicePrompt }
          ],
          temperature: 0.7,
          max_tokens: 100,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        aiAdvice = data.choices?.[0]?.message?.content || ''
      }
    } catch {
      aiAdvice = pendingTasks > 0
        ? `У тебя ${pendingTasks} задач. Начни с самых простых — они дадут быстрый прогресс.`
        : 'Добавь новые проекты для отслеживания.'
    }

    return NextResponse.json({
      top_actions: topActions.map(t => ({
        id: t.id,
        title: t.title,
        project: t.projects?.name || 'Unknown',
        type: t.task_type,
        difficulty: t.difficulty,
        priority_score: t.priority_score,
        reward_min: (t as any).reward_range?.min || 0,
        reward_max: (t as any).reward_range?.max || 0,
        deadline: t.deadline,
      })),
      urgent: urgentTasks.map(t => ({
        title: t.title,
        project: t.projects?.name || 'Unknown',
        hours_left: t.hours_left,
      })),
      opportunities: topOpportunities,
      progress: {
        completed: completedTasks,
        pending: pendingTasks,
        total: totalTasks,
        chains_covered: chainsCovered,
        active_wallets: activeWallets,
      },
      ai_advice: aiAdvice,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Today plan error:', error)
    return NextResponse.json({ error: 'Ошибка генерации плана' }, { status: 500 })
  }
}
