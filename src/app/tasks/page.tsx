'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckSquare, Check, Clock, Search } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useUserStore } from '@/store/userStore'
import { useAppData } from '@/hooks/useAppData'

const taskTypeInfo: Record<string, { icon: string; color: string }> = {
  swap: { icon: '🔄', color: 'cyan' },
  bridge: { icon: '🌉', color: 'purple' },
  stake: { icon: '📌', color: 'green' },
  mint: { icon: '🖼️', color: 'yellow' },
  discord: { icon: '💬', color: 'cyan' },
  social: { icon: '📱', color: 'orange' },
  testnet: { icon: '🧪', color: 'purple' },
}

const typeLabels: Record<string, string> = {
  swap: 'Свап',
  bridge: 'Бридж',
  stake: 'Стейк',
  mint: 'Минт',
  discord: 'Discord',
  social: 'Соцсети',
  testnet: 'Тестнет',
}

export default function TasksPage() {
  const { tasks } = useAppData()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({})
  const { incrementTasksDone, incrementXP } = useUserStore()

  useEffect(() => {
    async function loadStatuses() {
      try {
        const response = await fetch('/api/tasks/status')
        const statuses = await response.json()
        setTaskStatuses(statuses)
      } catch {
        // Use local storage fallback
        const stored = localStorage.getItem('crypto-hunter-task-statuses')
        if (stored) setTaskStatuses(JSON.parse(stored))
      }
    }
    loadStatuses()
  }, [])

  const getTaskStatus = (taskId: string) => taskStatuses[taskId] || 'pending'

  const toggleTask = async (taskId: string) => {
    const currentStatus = getTaskStatus(taskId)
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'

    // Optimistic update
    setTaskStatuses((prev) => ({ ...prev, [taskId]: newStatus }))

    // Save to localStorage
    const stored = localStorage.getItem('crypto-hunter-task-statuses')
    const statuses = stored ? JSON.parse(stored) : {}
    statuses[taskId] = newStatus
    localStorage.setItem('crypto-hunter-task-statuses', JSON.stringify(statuses))

    // Save to Supabase
    try {
      await fetch('/api/tasks/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus }),
      })
    } catch {
      // Silently fail, local storage is fallback
    }

    if (newStatus === 'completed') {
      incrementTasksDone()
      const task = tasks.find((t) => t.id === taskId)
      if (task) incrementXP(task.difficulty * 10)
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const status = getTaskStatus(task.id)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && status !== 'completed') ||
      (filter === 'completed' && status === 'completed')
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const completedCount = Object.values(taskStatuses).filter((s) => s === 'completed').length
  const totalCount = tasks.length
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Трекер задач</h1>
        <div className="flex items-center gap-2">
          <Badge variant="cyan">{completedCount}/{totalCount} выполнено</Badge>
          <Badge variant="green">{overallProgress}%</Badge>
        </div>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">Общий прогресс</span>
          <span className="text-sm font-mono text-cyan-400">{overallProgress}%</span>
        </div>
        <ProgressBar progress={overallProgress} color="cyan" />
      </GlassCard>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'all', label: 'Все' },
            { key: 'pending', label: 'Ожидает' },
            { key: 'completed', label: 'Выполнено' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-mono ${
                filter === f.key
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-bg-tertiary text-text-muted border border-white/10 hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredTasks.map((task, index) => {
          const info = taskTypeInfo[task.task_type] || { icon: '📋', color: 'cyan' }
          const status = getTaskStatus(task.id)

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <GlassCard
                glowOnHover={false}
                className={`p-3 ${
                  status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`p-2 rounded-lg border transition-colors ${
                      status === 'completed'
                        ? 'bg-green-500/20 border-green-500/30 text-green-400'
                        : 'bg-white/5 border-white/10 text-text-muted hover:text-cyan-400'
                    }`}
                  >
                    {status === 'completed' ? <Check size={16} /> : <CheckSquare size={16} />}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{info.icon}</span>
                      <span className={`text-sm ${
                        status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'
                      }`}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-text-muted">{(task as any).projects?.name || 'Неизвестно'}</span>
                      <Badge variant={info.color as any}>{typeLabels[task.task_type] || task.task_type}</Badge>
                      {task.deadline && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(task.deadline).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                      <span className="text-xs text-text-muted">+{task.difficulty * 10} XP</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
