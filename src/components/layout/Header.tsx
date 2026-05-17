'use client'

import { useState } from 'react'
import { Search, Bell, User, ChevronDown, RefreshCw } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { useSettingsStore } from '@/store/settingsStore'
import { getLevelTitle } from '@/lib/utils'

export function Header() {
  const { farmerLevel, streakDays, xp, reset: resetUser } = useUserStore()
  const { resetSettings } = useSettingsStore()
  const [showProfile, setShowProfile] = useState(false)

  const handleReset = () => {
    resetUser()
    resetSettings()
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Поиск проектов, задач, кошельков..."
              className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <button className="relative p-2 rounded-lg bg-bg-tertiary border border-white/10 hover:border-cyan-500/30 transition-colors">
            <Bell size={18} className="text-text-secondary" />
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-bg-tertiary border border-white/10 hover:border-red-500/30 transition-colors text-text-muted hover:text-red-400"
            title="Сбросить все данные"
          >
            <RefreshCw size={18} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-3 p-2 rounded-lg bg-bg-tertiary border border-white/10 hover:border-cyan-500/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-text-primary">Охотник</p>
                <p className="text-xs text-text-muted">Ур. {farmerLevel} • {getLevelTitle(farmerLevel)}</p>
              </div>
              <ChevronDown size={16} className="text-text-muted hidden md:block" />
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-2 w-64 bg-bg-secondary border border-white/10 rounded-xl shadow-xl p-4">
                <div className="text-center mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mx-auto mb-2">
                    <User size={24} className="text-white" />
                  </div>
                  <p className="font-medium text-text-primary">Охотник</p>
                  <p className="text-xs text-text-muted">Уровень {farmerLevel} — {getLevelTitle(farmerLevel)}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-muted">Опыт</span>
                    <span className="text-text-primary font-mono">{xp} / {farmerLevel * 500}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                      style={{ width: `${(xp / (farmerLevel * 500)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-text-muted">Стрик</span>
                    <span className="text-orange-400 font-mono">🔥 {streakDays} дн.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
