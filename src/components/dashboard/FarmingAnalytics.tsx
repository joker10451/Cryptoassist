'use client'

import { motion } from 'framer-motion'
import { BarChart, TrendingUp, Clock, DollarSign, Target, CheckCircle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { useUserStore } from '@/store/userStore'
import { formatCurrency } from '@/lib/utils'

export function FarmingAnalytics() {
  const { projectsTracked, projectsCompleted, tasksDone, estimatedPortfolioValue } = useUserStore()

  const stats = [
    { icon: Target, label: 'Отслеживается', value: projectsTracked.toString(), color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: CheckCircle, label: 'Завершено', value: projectsCompleted.toString(), color: 'text-green-400', bg: 'bg-green-500/10' },
    { icon: Clock, label: 'Задач выполнено', value: tasksDone.toString(), color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: DollarSign, label: 'Оценка', value: formatCurrency(estimatedPortfolioValue), color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ]

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <BarChart className="text-cyan-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Аналитика фарминга</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="p-3 rounded-lg bg-white/5"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-md ${stat.bg}`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <span className="text-xs text-text-muted">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-text-primary font-mono">{stat.value}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted mb-1">Изменение за неделю</p>
            <p className="text-lg font-bold text-text-muted font-mono">—</p>
          </div>
          <TrendingUp size={24} className="text-text-muted" />
        </div>
      </div>
    </GlassCard>
  )
}
