'use client'

import { motion } from 'framer-motion'
import { Target, DollarSign } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getProbabilityColor } from '@/lib/utils'
import { Project } from '@/types'

interface HighProbabilityAirdropsProps {
  projects?: Project[]
}

export function HighProbabilityAirdrops({ projects }: HighProbabilityAirdropsProps) {
  const highProbProjects = (projects || [])
    .filter((p) => p.token_status === 'no_token' && p.probability_score >= 70)
    .sort((a, b) => b.probability_score - a.probability_score)
    .slice(0, 4)

  if (highProbProjects.length === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-cyan-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Аирдропы с высокой вероятностью</h2>
        </div>
        <p className="text-sm text-text-muted text-center py-4">Нет доступных аирдропов</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Target className="text-cyan-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Аирдропы с высокой вероятностью</h2>
      </div>
      <div className="space-y-3">
        {highProbProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-text-primary">{project.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="purple">Нет токена</Badge>
                <span className={`text-sm font-mono ${getProbabilityColor(project.probability_score)}`}>
                  {project.probability_score}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted mb-2">
              <span className="flex items-center gap-1">
                <DollarSign size={12} />
                Оценка: {formatCurrency(project.estimated_reward_min || 0)} — {formatCurrency(project.estimated_reward_max || 0)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Инвесторы:</span>
              <span className="text-text-secondary">{project.investors.slice(0, 2).join(', ')}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}
