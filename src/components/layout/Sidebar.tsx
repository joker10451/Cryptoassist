'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap,
  FolderOpen,
  Wallet,
  CheckSquare,
  Brain,
  Bell,
  Trophy,
  Settings,
  Menu,
  X,
  Crosshair,
  Radar,
  AtSign,
} from 'lucide-react'

const navItems = [
  { icon: Zap, label: 'Сегодня', href: '/today' },
  { icon: FolderOpen, label: 'Проекты', href: '/projects' },
  { icon: Wallet, label: 'Кошельки', href: '/wallets' },
  { icon: CheckSquare, label: 'Задачи', href: '/tasks' },
  { icon: Brain, label: 'ИИ Центр', href: '/ai' },
  { icon: Radar, label: 'Скоринг', href: '/scoring' },
  { icon: AtSign, label: 'Реф-кампании', href: '/referrals' },
  { icon: Bell, label: 'Напоминания', href: '/reminders' },
  { icon: Trophy, label: 'Профиль', href: '/profile' },
  { icon: Settings, label: 'Настройки', href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-bg-glass backdrop-blur-xl border border-white/10 text-text-primary"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div
        className={`lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-bg-secondary border-r border-white/5 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <Crosshair size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Crypto Hunter</h1>
              <p className="text-xs text-text-muted font-mono">OS v0.1.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="p-4 rounded-lg bg-bg-tertiary border border-white/5">
            <p className="text-xs text-text-muted mb-2">Оценка портфеля</p>
            <p className="text-xl font-bold text-text-primary font-mono">$0</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-text-muted">Добавьте кошельки</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
