'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Clock, Brain, CheckCircle, AlertTriangle, RefreshCw, Sparkles, ExternalLink } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { PortfolioROI } from '@/components/dashboard/PortfolioROI'

const typeLabels: Record<string, string> = {
  bridge: 'Bridge', swap: 'Swap', stake: 'Stake', mint: 'Mint',
  social: 'Social', discord: 'Discord', testnet: 'Testnet', quest: 'Quest',
}

const typeIcons: Record<string, string> = {
  bridge: '🌉', swap: '🔄', stake: '📈', mint: '🖼️',
  social: '📱', discord: '💬', testnet: '🧪', quest: '⚔️',
}

const categoryColors: Record<string, string> = {
  LEGENDARY_ALPHA: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  HIGH_PRIORITY: 'text-green-400 bg-green-500/20 border-green-500/30',
  MEDIUM: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  LOW: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
  NOISE: 'text-red-400 bg-red-500/20 border-red-500/30',
}

interface Action {
  id: string
  title: string
  project: string
  type: string
  difficulty: number
  priority_score: number
  reward_min: number
  reward_max: number
  deadline: string | null
  url?: string
  category?: string
}

interface Opportunity {
  name: string
  probability: number
  reward_min: number
  reward_max: number
  category: string
  token_status: string
  score?: number
  ai_category?: string
}

interface Progress {
  completed: number
  pending: number
  total: number
  chains_covered: number
  active_wallets: number
}

interface TodayPlan {
  top_actions: Action[]
  urgent: { title: string; project: string; hours_left: number | null }[]
  opportunities: Opportunity[]
  progress: Progress
  ai_advice: string
  generated_at: string
}

export default function TodayPage() {
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [autoDiscovering, setAutoDiscovering] = useState(false)
  const [discoveredCount, setDiscoveredCount] = useState(0)

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/today/plan')
      const data = await res.json()
      if (data.top_actions) setPlan(data)
    } catch (e) {
      console.error('Fetch plan error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchPlan() }, [])

  const handleComplete = async (actionId: string) => {
    setCompletingId(actionId)
    setError(null)
    try {
      const res = await fetch(`/api/tasks/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_at: new Date().toISOString() }),
      })
      const data = await res.json()
      if (data.success) {
        setCompletedIds(prev => new Set(prev).add(actionId))
        setSuccess('Задача выполнена! ✓')
        setTimeout(() => {
          setCompletedIds(prev => {
            const next = new Set(prev)
            next.delete(actionId)
            return next
          })
          setSuccess(null)
          fetchPlan()
        }, 1000)
      } else {
        setError(data.error || 'Ошибка выполнения')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setCompletingId(null)
    }
  }

  const handleAutoDiscover = async () => {
    setAutoDiscovering(true)
    setError(null)
    try {
      const res = await fetch('/api/projects/auto-discover', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const added = data.added ?? 0
        const enriched = (data.enriched as { updated?: boolean }[] | undefined)?.filter((e) => e.updated).length ?? 0
        setDiscoveredCount(added)
        setSuccess(
          added > 0
            ? `+${added} новых, обогащено: ${enriched}`
            : `Новых нет (${data.existing ?? 0} уже есть)`,
        )
        fetchPlan()
        setTimeout(() => { setDiscoveredCount(0); setSuccess(null) }, 5000)
      } else {
        setError(data.error || 'Ошибка поиска')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setAutoDiscovering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Генерация плана...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Ошибка загрузки плана</p>
      </div>
    )
  }

  const completionRate = plan.progress.total > 0 ? Math.round((plan.progress.completed / plan.progress.total) * 100) : 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toasts */}
      {error && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-xs underline">Закрыть</button>
        </div>
      )}
      {success && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
            <Zap className="text-yellow-400" size={28} />
            TODAY OS
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {discoveredCount > 0 && (
            <span className="text-xs text-green-400 animate-pulse">+{discoveredCount} новых</span>
          )}
          <button
            onClick={handleAutoDiscover}
            disabled={autoDiscovering}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} className={autoDiscovering ? 'animate-pulse' : ''} />
            {autoDiscovering ? 'Поиск...' : 'Найти проекты'}
          </button>
          <button
            onClick={() => { setRefreshing(true); fetchPlan() }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
      </div>

      {/* AI Advice */}
      {plan.ai_advice && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="border-l-4 border-l-purple-500 bg-purple-500/5">
            <div className="flex items-start gap-3">
              <Brain className="text-purple-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="text-xs text-purple-400 font-mono mb-1">AI СОВЕТ ДНЯ</p>
                <p className="text-text-primary">{plan.ai_advice}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Daily Brief: X Growth Checklist */}
      <DailyBrief />

      {/* Portfolio ROI */}
      <PortfolioROI />

      {/* LAYER 1: ACTION NOW */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <h2 className="text-lg font-bold text-text-primary">ДЕЛАЙ СЕЙЧАС</h2>
          <span className="text-xs text-text-muted ml-auto">{plan.top_actions.length} задач</span>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {plan.top_actions.map((action, i) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard className={`flex items-center gap-4 transition-colors group ${
                  completedIds.has(action.id) ? 'opacity-50 bg-green-500/5' : 'hover:bg-white/5'
                }`}>
                  <div className="text-2xl">{typeIcons[action.type] || '📋'}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold truncate ${completedIds.has(action.id) ? 'text-green-400 line-through' : 'text-text-primary'}`}>
                        {action.title}
                      </h3>
                      <span className="text-xs text-text-muted">→</span>
                      <span className="text-xs text-cyan-400 font-mono">{action.project}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant={action.difficulty <= 2 ? 'green' : action.difficulty <= 3 ? 'yellow' : 'red'}>
                        {typeLabels[action.type] || action.type}
                      </Badge>
                      <span className="text-xs text-text-muted">Сложность: {action.difficulty}/5</span>
                      {action.deadline && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <Clock size={12} />
                          {Math.round((new Date(action.deadline).getTime() - Date.now()) / 3600000)}ч
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-text-muted">Награда</p>
                    <p className="text-green-400 font-mono font-bold text-sm">${action.reward_min}–{action.reward_max}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {action.url && (
                      <a
                        href={action.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/40 transition-colors flex items-center justify-center"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button
                      onClick={() => handleComplete(action.id)}
                      disabled={completingId === action.id || completedIds.has(action.id)}
                      className={`w-10 h-10 rounded-lg border transition-colors flex items-center justify-center disabled:opacity-50 ${
                        completedIds.has(action.id)
                          ? 'bg-green-500/40 text-green-300 border-green-500/50'
                          : 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/40'
                      }`}
                    >
                      {completingId === action.id ? (
                        <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                      ) : (
                        <CheckCircle size={20} />
                      )}
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>

          {plan.top_actions.length === 0 && (
            <GlassCard className="text-center py-8">
              <p className="text-text-muted">Нет активных задач. Нажми «Найти проекты» для авто-поиска!</p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* LAYER 2: OPPORTUNITIES */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <h2 className="text-lg font-bold text-text-primary">ГДЕ ДЕНЬГИ</h2>
          <span className="text-xs text-text-muted ml-auto">{plan.opportunities.length} проектов</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plan.opportunities.map((opp, i) => (
            <motion.div
              key={opp.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              <GlassCard>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-text-primary">{opp.name}</h3>
                    <p className="text-xs text-text-muted capitalize">{opp.category} • {opp.token_status === 'no_token' ? 'Нет токена' : 'Токен есть'}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-mono border ${
                    categoryColors[opp.ai_category || 'MEDIUM'] || categoryColors.MEDIUM
                  }`}>
                    {opp.score || opp.probability}%
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-text-muted">Награда:</span>
                  <span className="text-green-400 font-mono">${opp.reward_min || 0} — ${opp.reward_max || 0}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      {/* LAYER 3: TRACKING */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <h2 className="text-lg font-bold text-text-primary">ПРОГРЕСС</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard className="text-center">
            <p className="text-3xl font-bold text-green-400">{plan.progress.completed}</p>
            <p className="text-xs text-text-muted mt-1">Выполнено</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-3xl font-bold text-yellow-400">{plan.progress.pending}</p>
            <p className="text-xs text-text-muted mt-1">Осталось</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-3xl font-bold text-cyan-400">{plan.progress.chains_covered}</p>
            <p className="text-xs text-text-muted mt-1">Цепей</p>
          </GlassCard>
          <GlassCard className="text-center">
            <p className="text-3xl font-bold text-purple-400">{plan.progress.active_wallets}</p>
            <p className="text-xs text-text-muted mt-1">Кошельков</p>
          </GlassCard>
        </div>

        <GlassCard className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">Общий прогресс</span>
            <span className="text-sm font-mono text-cyan-400">{completionRate}%</span>
          </div>
          <div className="w-full h-3 bg-bg-tertiary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 0.5, delay: 0.5 }}
            />
          </div>
        </GlassCard>
      </div>

      {/* Urgent deadlines */}
      {plan.urgent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-red-400" size={18} />
            <h2 className="text-lg font-bold text-red-400">СРОЧНО</h2>
          </div>
          <div className="space-y-2">
            {plan.urgent.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <GlassCard className="border-l-4 border-l-red-500 bg-red-500/5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-primary">{item.title}</p>
                    <p className="text-xs text-text-muted">{item.project}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-mono font-bold">
                      {item.hours_left !== null && item.hours_left > 0 ? `${item.hours_left}ч` : 'Скоро!'}
                    </p>
                    <p className="text-xs text-text-muted">до дедлайна</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ---------- Daily Brief: X Growth Checklist --------------------------------

function DailyBrief() {
  const [stats, setStats] = useState<{ today: number; week: number } | null>(null)
  const [hotDetected, setHotDetected] = useState<{ name: string; slug: string; confidence: number }[]>([])

  useEffect(() => {
    fetch('/api/referrals/targets')
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .catch(() => {})

    fetch('/api/scoring/detected?status=pending')
      .then((r) => r.json())
      .then((d) => {
        const items = (d.detected ?? []) as { project_name: string; project_slug: string; confidence: number }[]
        setHotDetected(
          items
            .filter((it) => it.confidence >= 70)
            .slice(0, 3)
            .map((it) => ({ name: it.project_name, slug: it.project_slug, confidence: it.confidence })),
        )
      })
      .catch(() => {})
  }, [])

  const repliesToday = stats?.today ?? 0
  const repliesWeek = stats?.week ?? 0
  const target = 10

  const items = [
    { label: '2-3 alpha поста (рефки)', done: false, href: '/referrals' },
    { label: `${repliesToday}/${target} replies`, done: repliesToday >= target, href: '/referrals' },
    {
      label:
        hotDetected.length > 0
          ? `${hotDetected.length} новых alpha от детектора`
          : 'Проверить /scoring → Detected',
      done: false,
      href: '/scoring',
    },
  ]

  return (
    <GlassCard className="border-l-4 border-l-cyan-500 bg-cyan-500/5" glowOnHover={false}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-cyan-400 font-mono">X GROWTH CHECKLIST</p>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span>replies today: <span className={repliesToday >= target ? 'text-green-400' : 'text-text-primary'}>{repliesToday}</span>/{target}</span>
          <span>week: {repliesWeek}</span>
          {repliesToday >= target && <span className="text-green-400">🔥 streak</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.href}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-cyan-400 transition-colors"
          >
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
              item.done
                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                : 'border-white/20'
            }`}>
              {item.done ? '✓' : ''}
            </span>
            {item.label}
          </a>
        ))}
      </div>

      {hotDetected.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-[10px] text-text-muted mb-1.5 font-mono">HOT FROM DETECTOR</p>
          <div className="flex flex-wrap gap-1.5">
            {hotDetected.map((d) => (
              <a
                key={d.slug}
                href="/scoring"
                className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors"
              >
                {d.name} <span className="text-purple-400/60">{d.confidence}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}
