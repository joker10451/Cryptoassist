'use client'

import { motion } from 'framer-motion'
import { Trophy, Flame, Star, Target, Zap, Shield, Crown, Award, Lock } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useUserStore } from '@/store/userStore'
import { getLevelTitle, getRarityColor } from '@/lib/utils'
import { useSupabaseData } from '@/hooks/useSupabaseData'
import { useSettingsStore } from '@/store/settingsStore'

export default function ProfilePage() {
  const { xp, farmerLevel, streakDays, projectsTracked, projectsCompleted, tasksDone, walletsCount, estimatedPortfolioValue } = useUserStore()
  const { achievements } = useSupabaseData()
  const { username } = useSettingsStore()
  
  const xpNeeded = farmerLevel * 500
  const xpProgress = Math.round((xp / xpNeeded) * 100)

  const unlockedAchievements = achievements.slice(0, 8)

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            <Crown size={40} className="text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-text-primary">{username}</h1>
            <p className="text-text-muted">
              Уровень {farmerLevel} — <span className="text-cyan-400">{getLevelTitle(farmerLevel)}</span>
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Прогресс опыта</span>
                <span className="text-xs font-mono text-cyan-400">{xp} / {xpNeeded}</span>
              </div>
              <ProgressBar progress={xpProgress} color="cyan" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <Flame size={24} className="text-orange-400 mx-auto" />
              <p className="text-lg font-bold text-orange-400 font-mono">{streakDays}</p>
              <p className="text-xs text-text-muted">дн. стрик</p>
            </div>
            <div className="text-center">
              <Star size={24} className="text-yellow-400 mx-auto" />
              <p className="text-lg font-bold text-yellow-400 font-mono">{xp.toLocaleString()}</p>
              <p className="text-xs text-text-muted">всего XP</p>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Target, label: 'Проектов', value: projectsTracked, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { icon: Award, label: 'Завершено', value: projectsCompleted, color: 'text-green-400', bg: 'bg-green-500/10' },
          { icon: Zap, label: 'Задач', value: tasksDone, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: Shield, label: 'Кошельков', value: walletsCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <GlassCard className="text-center">
              <div className={`inline-flex p-3 rounded-xl ${stat.bg} mb-2`}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-text-primary font-mono">{stat.value}</p>
              <p className="text-xs text-text-muted">{stat.label}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted mb-1">Оценка портфеля фарминга</p>
            <p className="text-3xl font-bold text-green-400 font-mono">
              ${estimatedPortfolioValue.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-muted">—</p>
            <p className="text-xs text-text-muted">за неделю</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Достижения ({unlockedAchievements.length})</h2>
        
        {unlockedAchievements.length === 0 ? (
          <div className="text-center py-6">
            <Trophy size={32} className="text-text-muted mx-auto mb-2 opacity-30" />
            <p className="text-sm text-text-muted">Нет разблокированных достижений</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {unlockedAchievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.05 }}
                className="p-4 rounded-lg bg-white/5 border border-white/10 text-center"
              >
                <span className="text-3xl">{achievement.icon}</span>
                <p className="text-sm font-medium text-text-primary mt-2">{achievement.name}</p>
                <p className={`text-xs ${getRarityColor(achievement.rarity)}`}>{achievement.rarity}</p>
                <p className="text-xs text-text-muted mt-1">+{achievement.xp_reward} XP</p>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
