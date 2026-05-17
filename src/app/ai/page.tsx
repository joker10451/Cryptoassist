'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, FileText, Search, Wallet, Sparkles, Copy, Loader2, FilePlus2, Check } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useUserStore } from '@/store/userStore'
import { useAppData } from '@/hooks/useAppData'

type TabType = 'parser' | 'thread' | 'scorer' | 'analyzer'

interface ParsedProject {
  name: string
  slug: string
  category: string
  description: string | null
  website_url: string | null
  twitter_url: string | null
  tasks: { title: string; task_type: string; description: string | null; difficulty: number; deadline: string | null }[]
}

export default function AICenterPage() {
  const { projects } = useAppData()
  const [activeTab, setActiveTab] = useState<TabType>('parser')
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [parsedThread, setParsedThread] = useState<ParsedProject[] | null>(null)
  const [savingThread, setSavingThread] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const { incrementXP } = useUserStore()

  const tabs: { id: TabType; icon: typeof Brain; label: string; description: string }[] = [
    { id: 'parser', icon: FileText, label: 'Парсер задач', description: 'Один проект — задачи' },
    { id: 'thread', icon: FilePlus2, label: 'Парсер тредов', description: 'Twitter-тред → неск. проектов' },
    { id: 'scorer', icon: Search, label: 'Оценка проектов', description: 'ИИ оценивает проекты' },
    { id: 'analyzer', icon: Wallet, label: 'Анализ кошелька', description: 'Анализ активности' },
  ]

  const processInput = async () => {
    if (!inputText.trim()) return
    setIsProcessing(true)
    setResult(null)
    setParsedThread(null)
    setSaveResult(null)

    try {
      if (activeTab === 'thread') {
        const response = await fetch('/api/ai/parse-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'AI service error')
        }
        const data = await response.json()
        setParsedThread(data.projects || [])
        incrementXP(40)
        return
      }

      let endpoint: string
      let body: Record<string, any>

      if (activeTab === 'parser') {
        endpoint = '/api/ai/parse-tasks'
        body = { text: inputText }
      } else if (activeTab === 'scorer') {
        endpoint = '/api/ai/score-project'
        const project = projects.find((p) => p.name.toLowerCase().includes(inputText.toLowerCase()))
        body = {
          name: inputText,
          funding: project?.funding_amount,
          investors: project?.investors,
          tokenStatus: project?.token_status,
          category: project?.category,
        }
      } else {
        endpoint = '/api/ai/analyze-wallet'
        body = { address: inputText, activity: '' }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'AI service error')
      }

      const data = await response.json()

      let formatted = ''
      if (activeTab === 'parser') {
        formatted = `✅ Распознанные задачи:\n\n📋 Проект: ${data.project || 'Неизвестно'}\n\n`
        if (data.tasks && data.tasks.length > 0) {
          data.tasks.forEach((t: any, i: number) => {
            const title = t.title || t.action || 'Задача'
            const type = t.type || 'custom'
            const deadline = t.deadline ? ` [дедлайн: ${t.deadline}]` : ''
            formatted += `☐ ${title} [${type}]${deadline}\n`
          })
        } else {
          formatted += 'Нет задач для распознавания.\n'
        }
        const time = data.estimatedTime ?? 30
        const cost = data.estimatedCost ?? 0
        formatted += `\nПримерное время: ${time} мин | Примерная стоимость: ~$${cost}`
      } else if (activeTab === 'scorer') {
        formatted = `🎯 ИИ Оценка: ${inputText}\n\n`
        formatted += `Вероятность: ${data.probability}/100\n`
        formatted += `Ожидаемый ROI: $${data.estimatedRewardMin?.toLocaleString()} — $${data.estimatedRewardMax?.toLocaleString()}\n`
        formatted += `Уровень риска: ${data.riskLevel}/10\n`
        formatted += `Популярность: ${data.popularity}\n\n`
        formatted += `📝 Резюме:\n"${data.summary}"\n\n`
        formatted += `💡 Рекомендация:\n${data.recommendation}`
      } else {
        formatted = `🔍 Анализ кошелька: ${inputText}\n\n`
        formatted += `Сильные стороны:\n${data.strengths?.map((s: string) => `✅ ${s}`).join('\n')}\n\n`
        formatted += `Слабые стороны:\n${data.weaknesses?.map((w: string) => `⚠️ ${w}`).join('\n')}\n\n`
        formatted += `Рекомендации:\n${data.recommendations?.map((r: any) => `• ${r.action} → ${r.impact}`).join('\n')}\n\n`
        formatted += `Потенциальные проекты:\n${data.eligibleProjects?.map((p: any) => `• ${p.name}: ${p.score}%`).join('\n')}\n\n`
        formatted += `📝 ${data.summary}`
      }

      setResult(formatted)
      incrementXP(25)
    } catch (error: any) {
      const msg = error.message || ''
      if (msg.includes('таймаут')) {
        setResult('⏱️ AI сервис не отвечает (таймаут 10 сек). Попробуйте позже.')
      } else {
        setResult(`❌ Ошибка: ${msg}`)
      }
      console.error('AI processing error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const saveThread = async () => {
    if (!parsedThread || parsedThread.length === 0) return
    setSavingThread(true)
    setSaveResult(null)
    try {
      const response = await fetch('/api/projects/upsert-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: parsedThread }),
      })
      const data = await response.json()
      if (response.ok) {
        setSaveResult(
          `✅ Проектов: +${data.projectsCreated} новых, ${data.projectsExisting} уже были. Задач добавлено: ${data.tasksCreated}.${data.errors?.length ? ` Ошибок: ${data.errors.length}` : ''}`
        )
        incrementXP(50)
      } else {
        setSaveResult(`❌ ${data.error || 'Ошибка сохранения'}`)
      }
    } catch (e: any) {
      setSaveResult(`❌ ${e?.message || 'Ошибка сохранения'}`)
    } finally {
      setSavingThread(false)
    }
  }

  const renderContent = () => {
    if (activeTab === 'scorer') {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Выберите или введите название проекта</label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Например: Monad, LayerZero, Scroll..."
              className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {projects.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => setInputText(p.name)}
                className="px-2 py-1 text-xs bg-white/5 rounded-md hover:bg-white/10 transition-colors text-text-secondary"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div>
        <label className="text-sm text-text-secondary mb-1 block">
          {activeTab === 'parser'
            ? 'Вставь Twitter тред, сообщение Discord или сайт:'
            : activeTab === 'thread'
            ? 'Вставь тред/список с несколькими проектами (max 8000 символов):'
            : 'Введите адрес кошелька:'}
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            activeTab === 'parser'
              ? '🧵 Как фармить новый аирдроп @project: 1. Бридж минимум 0.1 ETH...'
              : activeTab === 'thread'
              ? '🔥 TOP-5 фармов этой недели:\n\n1. @MegaETH — бридж + своп на тестнете...\n2. @Initia — стейк INIT и quests на Galxe...\n3. @Aztec — ...'
              : '0x...'
          }
          rows={activeTab === 'thread' ? 10 : 6}
          className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50 resize-none"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="text-purple-400" size={24} />
        <h1 className="text-2xl font-bold text-text-primary">ИИ Центр</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setResult(null)
              setInputText('')
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === tab.id
                ? 'bg-purple-500/10 border-purple-500/30'
                : 'bg-bg-glass border-white/10 hover:border-purple-500/30'
            }`}
          >
            <tab.icon size={20} className={activeTab === tab.id ? 'text-purple-400' : 'text-text-muted'} />
            <p className="text-sm font-medium text-text-primary mt-2">{tab.label}</p>
            <p className="text-xs text-text-muted">{tab.description}</p>
          </button>
        ))}
      </div>

      <GlassCard>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          {tabs.find((t) => t.id === activeTab)?.label}
        </h2>

        {renderContent()}

        <button
          onClick={processInput}
          disabled={isProcessing || !inputText.trim()}
          className="mt-4 flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Обработка...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Обработать с ИИ
            </>
          )}
        </button>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30"
          >
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-purple-400" />
              <div>
                <p className="text-sm font-medium text-text-primary">AI обрабатывает запрос...</p>
                <p className="text-xs text-text-muted">Это может занять до 10 секунд</p>
              </div>
            </div>
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 10, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
              />
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-lg bg-bg-tertiary border border-white/10"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">Результат ИИ</span>
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="text-text-muted hover:text-cyan-400 transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>
            <pre className="text-sm text-text-secondary whitespace-pre-wrap font-mono">{result}</pre>
          </motion.div>
        )}

        {parsedThread && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                Найдено {parsedThread.length} проектов, {parsedThread.reduce((s, p) => s + p.tasks.length, 0)} задач
              </span>
              <button
                onClick={saveThread}
                disabled={savingThread || parsedThread.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
              >
                {savingThread ? (
                  <><Loader2 size={14} className="animate-spin" />Сохранение...</>
                ) : (
                  <><Check size={14} />Сохранить в БД</>
                )}
              </button>
            </div>
            {saveResult && (
              <p className="text-xs px-3 py-2 rounded-md bg-white/5 text-text-secondary">{saveResult}</p>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parsedThread.map((p, i) => (
                <div key={i} className="p-3 rounded-lg bg-bg-tertiary border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text-primary">{p.name}</span>
                    <Badge variant="cyan">{p.category}</Badge>
                    <span className="text-xs text-text-muted ml-auto">{p.tasks.length} задач</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-text-muted mb-2">{p.description}</p>
                  )}
                  {p.tasks.length > 0 && (
                    <ul className="space-y-1">
                      {p.tasks.map((t, j) => (
                        <li key={j} className="text-xs text-text-secondary flex items-start gap-2">
                          <span className="text-text-muted shrink-0">[{t.task_type}]</span>
                          <span>{t.title}</span>
                          <span className="ml-auto text-text-muted shrink-0">сл. {t.difficulty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Оценки проектов от ИИ</h3>
        <div className="space-y-3">
          {projects
            .sort((a, b) => b.probability_score - a.probability_score)
            .slice(0, 5)
            .map((project) => (
              <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-400">{project.probability_score}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{project.name}</p>
                  <p className="text-xs text-text-muted">
                    Оценка: ${project.estimated_reward_min?.toLocaleString()} — ${project.estimated_reward_max?.toLocaleString()}
                  </p>
                </div>
                <ProgressBar progress={project.probability_score} color={project.probability_score >= 80 ? 'green' : 'cyan'} />
              </div>
            ))}
        </div>
      </GlassCard>
    </div>
  )
}
