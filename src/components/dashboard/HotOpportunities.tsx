'use client'

import { motion } from 'framer-motion'
import { Flame, TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getProbabilityColor } from '@/lib/utils'
import { Project } from '@/types'

interface HotOpportunitiesProps {
  projects?: Project[]
}

export function HotOpportunities({ projects }: HotOpportunitiesProps) {
  const hotProjects = (projects || [])
    .filter((p) => p.probability_score >= 75)
    .sort((a, b) => b.probability_score - a.probability_score)
    .slice(0, 4)

  if (hotProjects.length === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="text-orange-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Горячие возможности</h2>
        </div>
        <p className="text-sm text-text-muted text-center py-4">Нет проектов с высокой вероятностью</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Flame className="text-orange-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Горячие возможности</h2>
      </div>
      <div className="space-y-3">
        {hotProjects.map((project, index) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-text-primary">{project.name}</span>
                <Badge variant={project.probability_score >= 85 ? 'green' : 'cyan'}>
                  {project.probability_score}%
                </Badge>
              </div>
              <span className={`text-sm font-mono ${getProbabilityColor(project.probability_score)}`}>
                {formatCurrency(project.estimated_reward_max || 0)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <TrendingUp size={12} />
                {project.category}
              </span>
              <span>{project.ecosystem}</span>
              <span>Сложность: {project.farming_difficulty}/10</span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}
