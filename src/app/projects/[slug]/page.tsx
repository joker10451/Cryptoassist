'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Sparkles, Copy, Link2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { getProbabilityColor } from '@/lib/utils'

interface ProjectDetail {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  ecosystem: string | null
  token_status: string | null
  probability_score: number | null
  funding_amount: number | null
  investors: string[] | null
  farming_cost: number | null
  farming_difficulty: number | null
  risk_score: number | null
  estimated_reward_min: number | null
  estimated_reward_max: number | null
  website_url: string | null
  twitter_url: string | null
  discord_url: string | null
  github_url: string | null
  referral_url: string | null
  referral_code: string | null
  referral_notes: string | null
  snapshot_status: string | null
  status: string | null
}

interface Task {
  id: string
  title: string
  task_type: string | null
  description: string | null
  difficulty: number | null
  status: string | null
  url: string | null
}

interface ScoreResult {
  score: number
  classification: string
  breakdown: Record<string, number>
  reasons: string[]
  missing_signals: string[]
  alpha_summary: string
  what_to_do_next: string[]
  red_flags: string[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [postGenerated, setPostGenerated] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
    ])
      .then(([projData, taskData]) => {
        const allProjects = Array.isArray(projData) ? projData : projData.projects ?? projData
        const found = (allProjects as ProjectDetail[]).find((p) => p.slug === slug)
        setProject(found ?? null)
        if (found) {
          const allTasks = Array.isArray(taskData) ? taskData : taskData.tasks ?? taskData
          const projectTasks = allTasks.filter(
            (t: unknown) => (t as { project_id?: string }).project_id === found.id,
          ) as Task[]
          setTasks(projectTasks)
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  async function runScore() {
    if (!project) return
    setScoring(true)
    try {
      const res = await fetch('/api/ai/score-project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          name: project.name,
          category: project.category,
          description: project.description,
          token_status: project.token_status,
          funding_amount: project.funding_amount,
          investors: project.investors,
          farming_cost_usd: project.farming_cost,
          has_product: true,
          skipAi: false,
        }),
      })
      const data = await res.json()
      if (res.ok) setScoreResult(data)
    } finally {
      setScoring(false)
    }
  }

  async function generatePost() {
    if (!project?.referral_url) return
    try {
      const res = await fetch('/api/referrals/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          template_id: 'alpha_drop',
          inputs: {
            project: project.name,
            feature: project.token_status === 'no_token' ? 'no token yet + points active' : 'active referral rewards',
          },
        }),
      })
      const data = await res.json()
      if (res.ok) setPostGenerated(data.body)
    } catch { /* */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Проект не найден</p>
        <button onClick={() => router.push('/projects')} className="mt-4 text-cyan-400 text-sm">
          ← Назад к проектам
        </button>
      </div>
    )
  }

  const score = project.probability_score ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/projects')} className="text-text-muted hover:text-cyan-400">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
          <p className="text-xs text-text-muted">
            {project.category} · {project.ecosystem} · {project.token_status}
          </p>
        </div>
        <div className={`text-3xl font-bold font-mono ${getProbabilityColor(score)}`}>
          {score}%
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard glowOnHover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Описание</h3>
          <p className="text-sm text-text-secondary">{project.description || 'Нет описания'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.website_url && (
              <a href={project.website_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                <ExternalLink size={11} /> Website
              </a>
            )}
            {project.twitter_url && (
              <a href={project.twitter_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                <ExternalLink size={11} /> Twitter
              </a>
            )}
            {project.discord_url && (
              <a href={project.discord_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                <ExternalLink size={11} /> Discord
              </a>
            )}
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 hover:underline">
                <ExternalLink size={11} /> GitHub
              </a>
            )}
          </div>
        </GlassCard>

        <GlassCard glowOnHover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Метрики</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Финансирование</span>
              <span className="text-text-primary font-mono">
                {project.funding_amount ? `$${(project.funding_amount / 1e6).toFixed(1)}M` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Инвесторы</span>
              <span className="text-text-primary text-xs">{(project.investors ?? []).join(', ') || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Стоимость фарма</span>
              <span className="text-text-primary font-mono">
                {project.farming_cost === 0 ? 'FREE' : `~$${project.farming_cost}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Сложность</span>
              <span className="text-text-primary">{project.farming_difficulty}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Риск</span>
              <span className="text-text-primary">{project.risk_score}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Награда</span>
              <span className="text-green-400 font-mono">
                ${project.estimated_reward_min ?? '?'} — ${project.estimated_reward_max ?? '?'}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Referral */}
      {project.referral_url && (
        <GlassCard glowOnHover={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-green-400" />
              <h3 className="text-sm font-semibold text-text-primary">Реферальная ссылка</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(project.referral_url!)}
                className="text-xs text-text-muted hover:text-cyan-400 flex items-center gap-1"
              >
                <Copy size={11} /> копировать
              </button>
              <button
                onClick={generatePost}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <Sparkles size={11} /> пост
              </button>
            </div>
          </div>
          <p className="text-xs text-cyan-400 font-mono mt-1 break-all">{project.referral_url}</p>
          {project.referral_notes && (
            <p className="text-xs text-text-muted mt-1">{project.referral_notes}</p>
          )}
          {postGenerated && (
            <div className="mt-3 p-3 rounded-md bg-bg-tertiary border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Готовый пост</span>
                <button
                  onClick={() => navigator.clipboard.writeText(postGenerated)}
                  className="text-text-muted hover:text-cyan-400"
                >
                  <Copy size={11} />
                </button>
              </div>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">{postGenerated}</pre>
            </div>
          )}
        </GlassCard>
      )}

      {/* Tasks */}
      <GlassCard glowOnHover={false}>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Задачи ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-text-muted">Нет задач для этого проекта</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-md bg-white/5">
                <Badge variant={t.status === 'completed' ? 'green' : 'cyan'}>
                  {t.task_type ?? 'task'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{t.title}</p>
                  {t.description && (
                    <p className="text-[11px] text-text-muted truncate">{t.description}</p>
                  )}
                </div>
                <span className="text-[11px] text-text-muted shrink-0">сл. {t.difficulty ?? '?'}</span>
                {t.url && (
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-text-muted hover:text-cyan-400">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Scoring */}
      <GlassCard glowOnHover={false}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">v2 Scoring</h3>
          <button
            onClick={runScore}
            disabled={scoring}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-purple-500/15 text-purple-300 rounded-md border border-purple-500/30 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
          >
            <Sparkles size={11} /> {scoring ? 'Считаю...' : 'Пересчитать'}
          </button>
        </div>

        {scoreResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold font-mono ${getProbabilityColor(scoreResult.score)}`}>
                {scoreResult.score}
              </span>
              <Badge variant={scoreResult.classification === 'HIGH_PRIORITY' ? 'green' : scoreResult.classification === 'LEGENDARY_ALPHA' ? 'green' : 'cyan'}>
                {scoreResult.classification}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(scoreResult.breakdown).map(([key, val]) => (
                <div key={key} className="text-center">
                  <p className="text-[10px] text-text-muted">{key.replace(/_/g, ' ')}</p>
                  <ProgressBar progress={val as number} color={key === 'risk' ? 'red' : 'cyan'} />
                  <p className="text-xs font-mono text-text-primary">{val as number}</p>
                </div>
              ))}
            </div>

            {scoreResult.alpha_summary && (
              <p className="text-sm text-text-secondary italic">{scoreResult.alpha_summary}</p>
            )}

            {scoreResult.what_to_do_next.length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-1">Что делать:</p>
                <ul className="text-xs text-text-secondary space-y-0.5">
                  {scoreResult.what_to_do_next.map((a, i) => (
                    <li key={i}>→ {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.missing_signals.length > 0 && (
              <p className="text-[11px] text-yellow-400">
                Нет данных: {scoreResult.missing_signals.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            Нажми «Пересчитать» чтобы получить детальный breakdown с AI-enrichment.
          </p>
        )}
      </GlassCard>
    </div>
  )
}
