'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, Clock, Calendar, Plus, Trash2, Check, RefreshCw } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'

type Reminder = {
  id: string
  title: string
  message: string | null
  type: 'snapshot' | 'deadline' | 'activity' | 'custom'
  scheduled_at: string
  project?: { name: string } | null
  channel: string
  sent_at: string | null
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [newType, setNewType] = useState<'snapshot' | 'deadline' | 'activity' | 'custom'>('custom')
  const [newDate, setNewDate] = useState('')
  const [newProject, setNewProject] = useState('')

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders')
      const data = await res.json()
      setReminders(data)
    } catch (e) {
      console.error('Fetch reminders error:', e)
      setReminders([])
    }
  }

  useEffect(() => {
    fetchReminders().finally(() => setLoading(false))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchReminders()
    setRefreshing(false)
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate) return
    setCreating(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          message: newMessage || undefined,
          type: newType,
          scheduled_at: new Date(newDate).toISOString(),
          project: newProject || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewTitle('')
        setNewMessage('')
        setNewDate('')
        setNewProject('')
        setShowAddForm(false)
        fetchReminders()
      }
    } catch (e) {
      console.error('Create reminder error:', e)
    } finally {
      setCreating(false)
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' })
      setReminders(reminders.filter((r) => r.id !== id))
    } catch (e) {
      console.error('Dismiss reminder error:', e)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await fetch(`/api/reminders?id=${id}&action=complete`, { method: 'DELETE' })
      setReminders(reminders.filter((r) => r.id !== id))
    } catch (e) {
      console.error('Complete reminder error:', e)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'snapshot': return <Calendar size={16} className="text-red-400" />
      case 'deadline': return <Clock size={16} className="text-yellow-400" />
      case 'activity': return <Bell size={16} className="text-cyan-400" />
      default: return <Bell size={16} className="text-purple-400" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'snapshot': return <Badge variant="red">Снимок</Badge>
      case 'deadline': return <Badge variant="yellow">Дедлайн</Badge>
      case 'activity': return <Badge variant="cyan">Активность</Badge>
      default: return <Badge variant="purple">Своё</Badge>
    }
  }

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    const diff = date.getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    const hours = Math.ceil(diff / (1000 * 60 * 60))
    if (diff < 0) return 'просрочено'
    if (days > 0) return `через ${days} дн.`
    if (hours > 0) return `через ${hours} ч.`
    return 'скоро'
  }

  const getIsOverdue = (dateStr: string) => {
    return new Date(dateStr).getTime() < Date.now()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Загрузка напоминаний...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="text-cyan-400" size={24} />
          <h1 className="text-2xl font-bold text-text-primary">Напоминания</h1>
          <span className="text-sm text-text-muted">({reminders.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            <Plus size={18} />
            Добавить
          </button>
        </div>
      </div>

      {showAddForm && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-text-primary mb-4">Новое напоминание</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Название</label>
              <input
                type="text"
                placeholder="Название напоминания..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Описание</label>
              <input
                type="text"
                placeholder="Описание (необязательно)..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Тип</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="custom">Своё</option>
                  <option value="snapshot">Снимок</option>
                  <option value="deadline">Дедлайн</option>
                  <option value="activity">Активность</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-1 block">Проект</label>
                <input
                  type="text"
                  placeholder="Название проекта..."
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Дата и время</label>
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newDate}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewMessage(''); setNewDate(''); setNewProject('') }}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {reminders.length === 0 ? (
        <GlassCard>
          <div className="text-center py-8">
            <Bell size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
            <p className="text-text-muted">Нет напоминаний</p>
            <p className="text-sm text-text-muted mt-1">Создайте первое напоминание о дедлайне или снимке</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder, index) => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard glowOnHover={false} className={getIsOverdue(reminder.scheduled_at) ? 'border-red-500/20' : ''}>
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-white/5">
                    {getTypeIcon(reminder.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-medium text-text-primary">{reminder.title}</h3>
                      {getTypeBadge(reminder.type)}
                      {getIsOverdue(reminder.scheduled_at) && (
                        <Badge variant="red">Просрочено</Badge>
                      )}
                    </div>
                    {reminder.message && (
                      <p className="text-xs text-text-secondary mb-2">{reminder.message}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {getTimeLabel(reminder.scheduled_at)}
                      </span>
                      {reminder.project?.name && (
                        <span>Проект: {reminder.project.name}</span>
                      )}
                      <span className="text-text-muted/60">
                        {new Date(reminder.scheduled_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleComplete(reminder.id)}
                      className="p-2 text-text-muted hover:text-green-400 transition-colors"
                      title="Выполнено"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => handleDismiss(reminder.id)}
                      className="p-2 text-text-muted hover:text-red-400 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
