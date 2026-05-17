'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

type EligibilityItem = {
  project: string
  progress: number
  status: string
  tasks: string
}

export function EligibilityProgress() {
  const [data, setData] = useState<EligibilityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((projects) => {
        const items = (projects || []).slice(0, 5).map((p: any) => ({
          project: p.name,
          progress: p.probability_score || 0,
          status: p.status || 'tracking',
          tasks: '0 задач',
        }))
        setData(items)
        setLoading(false)
      })
      .catch(() => {
        setData([])
        setLoading(false)
      })
  }, [])

  const statusLabels: Record<string, string> = {
    tracking: 'Отслеживается',
    in_progress: 'В процессе',
    completed: 'Завершено',
  }

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-cyan-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Прогресс элиджиблити</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Target className="text-cyan-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Прогресс элиджиблити</h2>
      </div>
      {data.length === 0 ? (
        <div className="text-center py-6">
          <Target size={32} className="text-text-muted mx-auto mb-2 opacity-30" />
          <p className="text-sm text-text-muted">Нет отслеживаемых проектов</p>
          <Link href="/projects" className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-block">
            Добавить проект →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, index) => (
            <motion.div
              key={item.project}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="p-3 rounded-lg bg-white/5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{item.project}</span>
                  <Badge
                    variant={
                      item.status === 'completed' ? 'green' :
                      item.status === 'in_progress' ? 'cyan' : 'purple'
                    }
                  >
                    {statusLabels[item.status] || 'Отслеживается'}
                  </Badge>
                </div>
                <span className="text-xs text-text-muted font-mono">{item.tasks}</span>
              </div>
              <ProgressBar
                progress={item.progress}
                color={
                  item.status === 'completed' ? 'green' :
                  item.progress >= 60 ? 'cyan' :
                  item.progress >= 30 ? 'yellow' : 'purple'
                }
              />
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
