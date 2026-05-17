'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, User, Database, Bell, Palette, Key, Download, Upload, Trash2, Check, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { useSettingsStore, ThemeName, AccentColor } from '@/store/settingsStore'

const themeConfigs: Record<ThemeName, { bg: string; name: string }> = {
  dark: { bg: '#0a0a0f', name: 'Тёмная' },
  deep: { bg: '#050508', name: 'Глубокая' },
  midnight: { bg: '#0f0f1a', name: 'Полночь' },
}

const accentColors: Record<AccentColor, string> = {
  cyan: '#00f0ff',
  purple: '#8b5cf6',
  green: '#10b981',
  blue: '#3b82f6',
  orange: '#f97316',
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    username, email, defaultNetwork, notifications, theme, accentColor,
    setUsername, setEmail, setDefaultNetwork, setNotification, setTheme, setAccentColor, resetSettings,
  } = useSettingsStore()

  const [localUsername, setLocalUsername] = useState(username)
  const [localEmail, setLocalEmail] = useState(email)
  const [localNetwork, setLocalNetwork] = useState(defaultNetwork)

  useEffect(() => {
    setLocalUsername(username)
    setLocalEmail(email)
    setLocalNetwork(defaultNetwork)
  }, [username, email, defaultNetwork])

  const handleSaveGeneral = () => {
    setSaving(true)
    setUsername(localUsername)
    setEmail(localEmail)
    setDefaultNetwork(localNetwork)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 300)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/settings/export')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crypto-hunter-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export error:', e)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        setImportResult({ imported: result.imported, errors: result.errors })
      }
    } catch (e) {
      console.error('Import error:', e)
      setImportResult({ imported: 0, errors: 1 })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await fetch('/api/settings/reset', { method: 'POST' })
      localStorage.clear()
      resetSettings()
      setShowResetConfirm(false)
      window.location.reload()
    } catch (e) {
      console.error('Reset error:', e)
    } finally {
      setResetting(false)
    }
  }

  const applyTheme = (themeName: ThemeName) => {
    setTheme(themeName)
    const root = document.documentElement
    const configs: Record<ThemeName, { primary: string; secondary: string; tertiary: string }> = {
      dark: { primary: '#0a0a0f', secondary: '#12121a', tertiary: '#1a1a2e' },
      deep: { primary: '#050508', secondary: '#0a0a10', tertiary: '#12121a' },
      midnight: { primary: '#0f0f1a', secondary: '#1a1a2e', tertiary: '#252540' },
    }
    const c = configs[themeName]
    root.style.setProperty('--bg-primary', c.primary)
    root.style.setProperty('--bg-secondary', c.secondary)
    root.style.setProperty('--bg-tertiary', c.tertiary)
  }

  const applyAccent = (color: AccentColor) => {
    setAccentColor(color)
    document.documentElement.style.setProperty('--accent-cyan', accentColors[color])
  }

  const sections = [
    { id: 'general', icon: User, label: 'Общие' },
    { id: 'notifications', icon: Bell, label: 'Уведомления' },
    { id: 'appearance', icon: Palette, label: 'Внешний вид' },
    { id: 'data', icon: Database, label: 'Данные' },
    { id: 'api', icon: Key, label: 'API ключи' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="text-cyan-400" size={24} />
        <h1 className="text-2xl font-bold text-text-primary">Настройки</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <GlassCard glowOnHover={false}>
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                    activeSection === section.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                >
                  <section.icon size={18} />
                  {section.label}
                </button>
              ))}
            </nav>
          </GlassCard>
        </div>

        <div className="lg:col-span-3">
          <GlassCard>
            {activeSection === 'general' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-text-primary">Общие настройки</h2>
                
                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Имя пользователя</label>
                  <input
                    type="text"
                    value={localUsername}
                    onChange={(e) => setLocalUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Email</label>
                  <input
                    type="email"
                    value={localEmail}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="text-sm text-text-secondary mb-1 block">Сеть по умолчанию</label>
                  <select
                    value={localNetwork}
                    onChange={(e) => setLocalNetwork(e.target.value)}
                    className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-500/50"
                  >
                    <option>Ethereum</option>
                    <option>Arbitrum</option>
                    <option>Optimism</option>
                    <option>Polygon</option>
                    <option>Base</option>
                    <option>BSC</option>
                    <option>Solana</option>
                  </select>
                </div>

                <button
                  onClick={handleSaveGeneral}
                  disabled={saving}
                  className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
                  {saving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить'}
                </button>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-text-primary">Настройки уведомлений</h2>
                
                {[
                  { key: 'snapshots' as const, label: 'Оповещения о снимках', description: 'Уведомлять когда снимки приближаются' },
                  { key: 'deadlines' as const, label: 'Напоминания о дедлайнах', description: 'Напоминать перед дедлайнами задач' },
                  { key: 'newOpportunities' as const, label: 'Новые возможности', description: 'Уведомлять когда добавлены высоковероятные проекты' },
                  { key: 'achievements' as const, label: 'Разблокировка достижений', description: 'Уведомлять при получении нового достижения' },
                  { key: 'weeklyReport' as const, label: 'Еженедельный отчёт', description: 'Отправлять еженедельный отчёт о прогрессе' },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <p className="text-sm text-text-primary">{setting.label}</p>
                      <p className="text-xs text-text-muted">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications[setting.key]}
                        onChange={(e) => setNotification(setting.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-text-primary">Внешний вид</h2>
                
                <div>
                  <p className="text-sm text-text-secondary mb-3">Тема</p>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(themeConfigs) as [ThemeName, typeof themeConfigs.dark][]).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => applyTheme(key)}
                        className={`p-4 rounded-lg border text-center transition-all ${
                          theme === key
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full mx-auto mb-2 border border-white/10" style={{ backgroundColor: config.bg }} />
                        <span className="text-xs">{config.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-text-secondary mb-3">Цвет акцента</p>
                  <div className="flex items-center gap-3">
                    {(Object.entries(accentColors) as [AccentColor, string][]).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => applyAccent(key)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          accentColor === key ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: value }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'data' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-text-primary">Управление данными</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassCard glowOnHover={false}>
                    <div className="flex items-center gap-3 mb-3">
                      <Download size={20} className="text-cyan-400" />
                      <h3 className="text-sm font-medium text-text-primary">Экспорт данных</h3>
                    </div>
                    <p className="text-xs text-text-muted mb-3">Скачать все данные в JSON</p>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {exporting ? 'Экспорт...' : 'Экспорт'}
                    </button>
                  </GlassCard>

                  <GlassCard glowOnHover={false}>
                    <div className="flex items-center gap-3 mb-3">
                      <Upload size={20} className="text-purple-400" />
                      <h3 className="text-sm font-medium text-text-primary">Импорт данных</h3>
                    </div>
                    <p className="text-xs text-text-muted mb-3">Восстановить из резервной копии</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImport(file)
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="w-full px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {importing ? 'Импорт...' : 'Импорт'}
                    </button>
                    {importResult && (
                      <p className="text-xs mt-2 text-text-muted">
                        Импортировано: {importResult.imported}, Ошибки: {importResult.errors}
                      </p>
                    )}
                  </GlassCard>
                </div>

                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 size={20} className="text-red-400" />
                    <h3 className="text-sm font-medium text-red-400">Опасная зона</h3>
                  </div>
                  <p className="text-xs text-text-secondary mb-3">Это навсегда удалит все ваши данные</p>
                  {!showResetConfirm ? (
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-400 transition-colors text-sm"
                    >
                      Удалить все данные
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-400">Вы уверены?</p>
                      <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-500 disabled:opacity-50"
                      >
                        {resetting ? 'Удаление...' : 'Да, удалить'}
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1 bg-white/10 text-text-secondary rounded text-xs hover:bg-white/20"
                      >
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'api' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-text-primary">API ключи</h2>
                
                <div className="p-4 rounded-lg bg-bg-tertiary border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-primary">Supabase URL</span>
                    <Badge variant="green">Подключено</Badge>
                  </div>
                  <input
                    type="text"
                    defaultValue={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://saravskicienmeezsers.supabase.co'}
                    className="w-full px-4 py-2 bg-bg-primary border border-white/10 rounded-lg text-sm text-text-primary font-mono focus:outline-none"
                    readOnly
                  />
                </div>

                <div className="p-4 rounded-lg bg-bg-tertiary border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-primary">NVIDIA API</span>
                    <Badge variant="green">Подключено</Badge>
                  </div>
                  <input
                    type="text"
                    defaultValue="nvapi-****"
                    className="w-full px-4 py-2 bg-bg-primary border border-white/10 rounded-lg text-sm text-text-primary font-mono focus:outline-none"
                    readOnly
                  />
                  <p className="text-xs text-text-muted mt-2">Модель: meta/llama-3.1-8b-instruct</p>
                </div>

                <div className="p-4 rounded-lg bg-bg-tertiary border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-primary">Telegram Bot</span>
                    <Badge variant="yellow">Не настроен</Badge>
                  </div>
                  <p className="text-xs text-text-muted">
                    Добавьте TELEGRAM_BOT_TOKEN в .env.local для работы бота
                  </p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
