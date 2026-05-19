'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Grid, List, ExternalLink, RefreshCw, Plus, Database } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, getProbabilityColor, getProbabilityBg } from '@/lib/utils'
import { useSupabaseData } from '@/hooks/useSupabaseData'

const categoryLabels: Record<string, string> = {
  all: 'Все',
  layer1: 'LAYER1',
  layer2: 'LAYER2',
  defi: 'DEFI',
  infra: 'ИНФРА',
  nft: 'NFT',
  gaming: 'GAME',
}

const tokenStatusLabels: Record<string, string> = {
  no_token: 'Нет токена',
  rumored: 'Руморы',
  announced: 'Анонс',
  launched: 'Запущен',
}

const snapshotStatusLabels: Record<string, string> = {
  unknown: 'Неизвестно',
  active: 'Активен',
  passed: 'Прошёл',
  upcoming: 'Скоро',
}

export default function ProjectsPage() {
  const { projects, loading, refresh } = useSupabaseData()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [discovering, setDiscovering] = useState(false)
  const [discoveredCount, setDiscoveredCount] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [autoRefreshStatus, setAutoRefreshStatus] = useState<'idle' | 'refreshing' | 'done'>('idle')
  const [enrichStatus, setEnrichStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [enrichSummary, setEnrichSummary] = useState<string | null>(null)
  const [rescoreStatus, setRescoreStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [rescoreSummary, setRescoreSummary] = useState<string | null>(null)
  const [refOnly, setRefOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'score' | 'funding' | 'created' | 'name'>('score')

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh()
    }, 5 * 60 * 1000) // 5 минут

    return () => clearInterval(interval)
  }, [])

  const categories = ['all', 'layer1', 'layer2', 'defi', 'infra', 'nft', 'gaming']

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const res = await fetch('/api/projects/auto-discover', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setDiscoveredCount(data.added ?? 0)
        refresh()
        setTimeout(() => setDiscoveredCount(0), 4000)
      }
    } catch (e) {
      console.error('Discover error:', e)
    } finally {
      setDiscovering(false)
    }
  }

  const handleRefresh = async () => {
    setAutoRefreshStatus('refreshing')
    try {
      const res = await fetch('/api/projects/refresh', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setDiscoveredCount(data.added)
        setLastRefreshed(new Date())
        refresh()
        setTimeout(() => setAutoRefreshStatus('done'), 500)
        setTimeout(() => setAutoRefreshStatus('idle'), 3000)
      }
    } catch (e) {
      console.error('Refresh error:', e)
    }
  }

  const handleAddProject = async () => {
    if (!addUrl.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl }),
      })
      const data = await res.json()
      if (data.success) {
        setAddUrl('')
        setShowAddModal(false)
        refresh()
      } else {
        alert(data.error || 'Ошибка добавления')
      }
    } catch (e) {
      alert('Ошибка сети')
    } finally {
      setAdding(false)
    }
  }

  const handleEnrich = async () => {
    if (enrichStatus === 'running') return
    setEnrichStatus('running')
    setEnrichSummary(null)
    try {
      const res = await fetch('/api/projects/enrich-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, limit: 50 }),
      })
      const data = await res.json()
      if (res.ok) {
        const cgCount = data.results?.filter((r: { sources: { cg: boolean } }) => r.sources.cg).length ?? 0
        const dlCount = data.results?.filter((r: { sources: { dl: boolean } }) => r.sources.dl).length ?? 0
        const ghCount = data.results?.filter((r: { sources: { gh: string | null } }) => r.sources.gh).length ?? 0
        setEnrichSummary(
          `Обогащено: ${data.updated_count}/${data.total} · CoinGecko: ${cgCount}, DefiLlama: ${dlCount}, GitHub: ${ghCount}`,
        )
        refresh()
        setEnrichStatus('done')
        setTimeout(() => setEnrichStatus('idle'), 5000)
      } else {
        setEnrichSummary(`Ошибка: ${data.error || 'unknown'}`)
        setEnrichStatus('idle')
      }
    } catch (err) {
      setEnrichSummary(`Ошибка: ${(err as Error).message}`)
      setEnrichStatus('idle')
    }
  }

  const handleRescore = async () => {
    if (rescoreStatus === 'running') return
    setRescoreStatus('running')
    setRescoreSummary(null)
    try {
      const res = await fetch('/api/projects/rescore-all', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setRescoreSummary(
          `Пересчитано: ${data.updated}/${data.total_projects}` +
            (data.top_changes?.[0]
              ? ` · топ-смещение: ${data.top_changes[0].slug} ${data.top_changes[0].old}→${data.top_changes[0].new}`
              : ''),
        )
        refresh()
        setRescoreStatus('done')
        setTimeout(() => setRescoreStatus('idle'), 5000)
      } else {
        setRescoreSummary(`Ошибка: ${data.error || 'unknown'}`)
        setRescoreStatus('idle')
      }
    } catch (err) {
      setRescoreSummary(`Ошибка: ${(err as Error).message}`)
      setRescoreStatus('idle')
    }
  }

  const filteredProjects = projects
    .filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === 'all' || project.category === filterCategory
      const matchesRef = !refOnly || (project.referral_url && project.referral_url.trim().length > 0)
      return matchesSearch && matchesCategory && matchesRef
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'funding':
          return (b.funding_amount ?? 0) - (a.funding_amount ?? 0)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        case 'score':
        default:
          return (b.probability_score ?? 0) - (a.probability_score ?? 0)
      }
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Загрузка проектов...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">База проектов</h1>
          {lastRefreshed && (
            <p className="text-xs text-text-muted mt-1">
              Обновлено: {lastRefreshed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {enrichSummary && (
            <p className="text-xs text-orange-300 mt-1">{enrichSummary}</p>
          )}
          {rescoreSummary && (
            <p className="text-xs text-cyan-300 mt-1">{rescoreSummary}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {discoveredCount > 0 && (
            <span className="text-xs text-green-400 animate-pulse">
              +{discoveredCount} новых
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={autoRefreshStatus === 'refreshing'}
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
              autoRefreshStatus === 'done'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
            }`}
          >
            <RefreshCw size={14} className={autoRefreshStatus === 'refreshing' ? 'animate-spin' : ''} />
            {autoRefreshStatus === 'refreshing' ? 'Обновление...' : autoRefreshStatus === 'done' ? 'Обновлено' : 'Обновить'}
          </button>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={discovering ? 'animate-spin' : ''} />
            Авто-поиск
          </button>
          <button
            onClick={handleEnrich}
            disabled={enrichStatus === 'running'}
            title="Обогатить проекты данными из CoinGecko, DefiLlama, GitHub и DropsTab"
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
              enrichStatus === 'done'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
            }`}
          >
            <Database size={14} className={enrichStatus === 'running' ? 'animate-pulse' : ''} />
            {enrichStatus === 'running' ? 'Обогащение…' : enrichStatus === 'done' ? 'Готово' : 'Обогатить из API'}
          </button>
          <button
            onClick={handleRescore}
            disabled={rescoreStatus === 'running'}
            title="Пересчитать probability_score через v2 движок (быстро, без AI)"
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
              rescoreStatus === 'done'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30'
            }`}
          >
            <RefreshCw size={14} className={rescoreStatus === 'running' ? 'animate-spin' : ''} />
            {rescoreStatus === 'running' ? 'Пересчёт…' : rescoreStatus === 'done' ? 'Готово' : 'Пересчитать score'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            <Plus size={14} />
            Добавить
          </button>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-text-muted hover:text-text-primary'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-bg-secondary border border-white/10 rounded-xl p-6"
          >
            <h2 className="text-lg font-bold mb-4">Добавить проект</h2>
            <p className="text-sm text-text-secondary mb-4">
              Вставь URL статьи, Twitter поста или сайта проекта. AI извлечёт информацию автоматически.
            </p>
            <input
              type="url"
              placeholder="https://..."
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              className="w-full px-4 py-3 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddModal(false); setAddUrl('') }}
                className="flex-1 px-4 py-2 text-sm bg-bg-tertiary text-text-secondary rounded-lg hover:bg-bg-tertiary/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAddProject}
                disabled={adding || !addUrl.trim()}
                className="flex-1 px-4 py-2 text-sm bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                {adding ? 'Анализ...' : 'Добавить'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Поиск проектов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap ${
                filterCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-bg-tertiary text-text-muted border border-white/10 hover:text-text-primary'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
          <button
            onClick={() => setRefOnly((v) => !v)}
            title="Показать только проекты с реферальной ссылкой"
            className={`px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap ${
              refOnly
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-bg-tertiary text-text-muted border border-white/10 hover:text-text-primary'
            }`}
          >
            REF
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'funding' | 'created' | 'name')}
            className="px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap bg-bg-tertiary text-text-muted border border-white/10 hover:text-text-primary focus:outline-none focus:border-cyan-500/50"
            title="Сортировка"
          >
            <option value="score">SCORE ↓</option>
            <option value="funding">FUNDING ↓</option>
            <option value="created">NEWEST ↓</option>
            <option value="name">NAME A-Z</option>
          </select>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <a href={`/projects/${project.slug}`} className="text-lg font-bold text-text-primary hover:text-cyan-400 transition-colors flex items-center gap-2">
                      {project.name}
                      {project.referral_url && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          REF
                        </span>
                      )}
                    </a>
                    <p className="text-xs text-text-muted capitalize">{project.category} • {project.ecosystem}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-xs font-mono border ${getProbabilityBg(project.probability_score)}`}>
                    <span className={getProbabilityColor(project.probability_score)}>{project.probability_score}%</span>
                  </div>
                </div>

                <p className="text-sm text-text-secondary mb-3 line-clamp-2">{project.description}</p>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Финансирование</span>
                    <span className="text-text-primary font-mono">{formatCurrency(project.funding_amount || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Оценка награды</span>
                    <span className="text-green-400 font-mono">
                      {formatCurrency(project.estimated_reward_min || 0)} — {formatCurrency(project.estimated_reward_max || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Стоимость</span>
                    <span className="text-text-primary font-mono">{project.farming_cost === 0 ? 'БЕСПЛАТНО' : `~$${project.farming_cost}`}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={project.token_status === 'no_token' ? 'green' : 'yellow'}>
                    {tokenStatusLabels[project.token_status]}
                  </Badge>
                  <Badge variant={project.snapshot_status === 'active' ? 'red' : 'purple'}>
                    {snapshotStatusLabels[project.snapshot_status]}
                  </Badge>
                  <span className="text-xs text-text-muted">Риск: {project.risk_score}/10</span>
                </div>

                {project.investors.length > 0 && (
                  <p className="text-xs text-text-secondary mt-2">
                    Инвесторы: {project.investors.slice(0, 3).join(', ')}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {project.website_url && (
                      <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-cyan-400 transition-colors">
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {project.twitter_url && (
                      <a href={project.twitter_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-cyan-400 transition-colors">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {project.discord_url && (
                      <a href={project.discord_url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-cyan-400 transition-colors">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1201.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                      </a>
                    )}
                  </div>
                  <button className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-md border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors">
                    Отслеживать
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GlassCard className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-text-primary">{project.name}</h3>
                  <p className="text-xs text-text-muted capitalize">{project.category} • {project.ecosystem}</p>
                </div>
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Финанс.</p>
                    <p className="font-mono text-text-primary">{formatCurrency(project.funding_amount || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Награда</p>
                    <p className="font-mono text-green-400">{formatCurrency(project.estimated_reward_max || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Вероятн.</p>
                    <p className={`font-mono ${getProbabilityColor(project.probability_score)}`}>{project.probability_score}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={project.token_status === 'no_token' ? 'green' : 'yellow'}>
                    {tokenStatusLabels[project.token_status]}
                  </Badge>
                  <button className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-md border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors">
                    Отслеживать
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
