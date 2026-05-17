'use client'

import { motion } from 'framer-motion'
import { Clock, AlertTriangle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { Project } from '@/types'

interface EndingSoonProps {
  projects?: Project[]
}

export function EndingSoon({ projects }: EndingSoonProps) {
  const endingSoon = (projects || [])
    .filter((p) => p.deadline || p.snapshot_status === 'active')
    .sort((a, b) => {
      const dateA = a.deadline || a.snapshot_date
      const dateB = b.deadline || b.snapshot_date
      if (!dateA || !dateB) return 0
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })
    .slice(0, 3)

  if (endingSoon.length === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-yellow-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Скоро заканчивается</h2>
        </div>
        <p className="text-sm text-text-muted text-center py-4">Нет срочных дедлайнов</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="text-yellow-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Скоро заканчивается</h2>
      </div>
      <div className="space-y-3">
        {endingSoon.map((project, index) => {
          const deadline = project.deadline || project.snapshot_date
          const daysLeft = deadline
            ? Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-3 rounded-lg border ${
                daysLeft !== null && daysLeft <= 2
                  ? 'bg-red-500/10 border-red-500/30 animate-pulse'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text-primary">{project.name}</span>
                {daysLeft !== null && (
                  <Badge variant={daysLeft <= 2 ? 'red' : 'yellow'}>
                    {daysLeft <= 0 ? 'Сегодня!' : `${daysLeft} дн.`}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <AlertTriangle size={12} className="text-yellow-400" />
                <span>
                  {project.snapshot_status === 'active' ? 'Снимок активен' : 'Дедлайн приближается'}
                </span>
              </div>
              {project.snapshot_date && (
                <p className="text-xs text-text-secondary mt-1">
                  Снимок: {daysLeft !== null && daysLeft > 0 ? `через ${daysLeft} дн.` : 'сегодня'}
                </p>
              )}
            </motion.div>
          )
        })}
      </div>
    </GlassCard>
  )
}
