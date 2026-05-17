'use client'

import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'

export function RecentActivity() {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="text-cyan-400" size={20} />
        <h2 className="text-lg font-semibold text-text-primary">Последняя активность</h2>
      </div>
      <div className="text-center py-6">
        <Bell size={32} className="text-text-muted mx-auto mb-2 opacity-30" />
        <p className="text-sm text-text-muted">Нет активности</p>
      </div>
    </GlassCard>
  )
}
