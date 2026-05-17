'use client'

import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'

export function AIRecommendations() {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="text-purple-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">ИИ Рекомендации</h2>
      </div>
      <div className="text-center py-6">
        <Brain size={32} className="text-text-muted mx-auto mb-2 opacity-30" />
        <p className="text-sm text-text-muted">Нет рекомендаций</p>
        <p className="text-xs text-text-muted mt-1">Добавьте кошельки и проекты для ИИ анализа</p>
      </div>
    </GlassCard>
  )
}
