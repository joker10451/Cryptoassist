'use client'

import { motion } from 'framer-motion'
import { Gift, DollarSign } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Project } from '@/types'

interface FreeOpportunitiesProps {
  projects?: Project[]
}

export function FreeOpportunities({ projects }: FreeOpportunitiesProps) {
  const freeProjects = (projects || [])
    .filter((p) => p.farming_cost === 0 || p.farming_cost <= 20)
    .slice(0, 4)

  if (freeProjects.length === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Gift className="text-green-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Бесплатные возможности</h2>
        </div>
        <p className="text-sm text-text-muted text-center py-4">Нет бесплатных проектов</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Gift className="text-green-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Бесплатные возможности</h2>
      </div>
      <div className="space-y-3">
        {freeProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-text-primary">{project.name}</span>
              <Badge variant="green">
                {project.farming_cost === 0 ? 'БЕСПЛАТНО' : '< $20'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <DollarSign size={12} />
                Оценка: {formatCurrency(project.estimated_reward_max || 0)}
              </span>
              <span>{project.category}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}
