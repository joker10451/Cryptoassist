'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus, Trash2, Copy, ExternalLink, Tag, Loader2, Activity, RefreshCw, Edit2, Check, X, Flame, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatAddress } from '@/lib/utils'
import { useUserStore } from '@/store/userStore'

type WalletData = {
  id: string
  address: string
  label: string | null
  tags: string[]
  chain: string
  created_at: string
  projects?: number
  completed?: number
  eligibility?: { project: string; score: number }[]
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<Record<string, any>>({})
  const [calculatingCosts, setCalculatingCosts] = useState<string | null>(null)
  const [costsResult, setCostsResult] = useState<Record<string, any>>({})
  const [sybilLoading, setSybilLoading] = useState(false)
  const [sybilReport, setSybilReport] = useState<any | null>(null)
  const [sybilExpanded, setSybilExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTags, setEditTags] = useState('')
  const [eligibilityLoading, setEligibilityLoading] = useState<string | null>(null)
  const [eligibilityResults, setEligibilityResults] = useState<Record<string, { wallet_summary: any; eligibility: any[] }>>({})
  const { incrementWalletsCount, decrementWalletsCount, setPortfolioValue } = useUserStore()

  const fetchWallets = async () => {
    try {
      const res = await fetch('/api/wallets')
      const data = await res.json()
      setWallets(data.map((w: WalletData) => ({
        ...w,
        projects: 0,
        completed: 0,
        eligibility: [],
      })))
    } catch (e) {
      console.error('Fetch wallets error:', e)
      setWallets([])
    }
  }

  useEffect(() => {
    fetchWallets().finally(() => setLoading(false))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchWallets()
    setRefreshing(false)
  }

  const addWallet = async () => {
    if (!newAddress.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: newAddress.trim(),
          label: newLabel.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewAddress('')
        setNewLabel('')
        setShowAddForm(false)
        incrementWalletsCount()
        fetchWallets()
      }
    } catch (e) {
      console.error('Create wallet error:', e)
    } finally {
      setCreating(false)
    }
  }

  const removeWallet = async (id: string) => {
    try {
      const res = await fetch(`/api/wallets?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setWallets(wallets.filter((w) => w.id !== id))
        decrementWalletsCount()
      }
    } catch (e) {
      console.error('Delete wallet error:', e)
    }
  }

  const startEdit = (wallet: WalletData) => {
    setEditingId(wallet.id)
    setEditLabel(wallet.label || '')
    setEditTags(wallet.tags.join(', '))
  }

  const saveEdit = async (id: string) => {
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await fetch('/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: editLabel, tags }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        fetchWallets()
      }
    } catch (e) {
      console.error('Update wallet error:', e)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
  }

  const analyzeWallet = async (address: string) => {
    setAnalyzing(address)
    try {
      const response = await fetch('/api/onchain/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await response.json()
      setAnalysisResult((prev) => {
        const next = { ...prev, [address]: data }
        const total = Object.values(next).reduce((s: number, a: any) => s + (a?.totalUsdValue || 0), 0)
        setPortfolioValue(Math.round(total))
        return next
      })
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setAnalyzing(null)
    }
  }

  const runSybilCheck = async () => {
    if (wallets.length < 2) return
    setSybilLoading(true)
    try {
      const response = await fetch('/api/onchain/sybil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: wallets.map((w) => w.address) }),
      })
      const data = await response.json()
      setSybilReport(data)
    } catch (e) {
      console.error('Sybil error:', e)
    } finally {
      setSybilLoading(false)
    }
  }

  const calculateCosts = async (address: string) => {
    setCalculatingCosts(address)
    try {
      const response = await fetch('/api/onchain/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const data = await response.json()
      setCostsResult((prev) => ({ ...prev, [address]: data }))
    } catch (error) {
      console.error('Costs error:', error)
    } finally {
      setCalculatingCosts(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Загрузка кошельков...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="text-cyan-400" size={24} />
          <h1 className="text-2xl font-bold text-text-primary">Управление кошельками</h1>
          <span className="text-sm text-text-muted">({wallets.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {wallets.length >= 2 && (
            <button
              onClick={runSybilCheck}
              disabled={sybilLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
            >
              {sybilLoading ? (
                <><Loader2 size={18} className="animate-spin" />Анализ...</>
              ) : (
                <><ShieldAlert size={18} />Sybil-проверка</>
              )}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            <Plus size={18} />
            Добавить кошелёк
          </button>
        </div>
      </div>

      {sybilReport && (
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className={sybilReport.atRisk > 0 ? 'text-red-400' : 'text-green-400'} size={20} />
              <h3 className="text-lg font-semibold text-text-primary">Sybil-анализ</h3>
              <span className="text-xs text-text-muted">
                {sybilReport.atRisk > 0
                  ? `${sybilReport.atRisk} пар с риском из ${sybilReport.pairs?.length || 0}`
                  : `все ${sybilReport.pairs?.length || 0} пар чисты`}
              </span>
            </div>
            <button
              onClick={() => setSybilExpanded(!sybilExpanded)}
              className="text-text-muted hover:text-text-primary"
            >
              {sybilExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {sybilReport.warning && (
            <p className="text-sm text-yellow-400">{sybilReport.warning}</p>
          )}
          {sybilExpanded && sybilReport.pairs?.length > 0 && (
            <div className="space-y-2">
              {sybilReport.pairs.map((pair: any, idx: number) => {
                const colors: Record<string, string> = {
                  critical: 'border-red-500/40 bg-red-500/10 text-red-300',
                  high: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
                  medium: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
                  low: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
                  clean: 'border-green-500/40 bg-green-500/10 text-green-300',
                }
                const cls = colors[pair.riskLevel] || colors.clean
                const labelA = wallets.find(w => w.address.toLowerCase() === pair.walletA.toLowerCase())?.label || formatAddress(pair.walletA)
                const labelB = wallets.find(w => w.address.toLowerCase() === pair.walletB.toLowerCase())?.label || formatAddress(pair.walletB)
                return (
                  <div key={idx} className={`p-3 rounded-lg border ${cls}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">
                        {labelA} ↔ {labelB}
                      </div>
                      <div className="text-xs uppercase font-mono">
                        {pair.riskLevel} ({pair.riskScore})
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-text-muted">Direct tx</p>
                        <p className="font-mono">{pair.directTransfers}</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Общих counterparties</p>
                        <p className="font-mono">{pair.commonCounterparties?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Общий funder</p>
                        <p className="font-mono">{pair.sharedFunder ? 'Да' : 'Нет'}</p>
                      </div>
                    </div>
                    {pair.sharedFunder && (
                      <p className="mt-2 text-xs text-text-muted font-mono">
                        Фандер: {formatAddress(pair.sharedFunder)}
                      </p>
                    )}
                    {pair.commonCounterparties?.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-text-muted cursor-pointer hover:text-text-primary">
                          Показать {pair.commonCounterparties.length} общих адресов
                        </summary>
                        <div className="mt-1 space-y-0.5 font-mono text-xs text-text-muted max-h-32 overflow-y-auto">
                          {pair.commonCounterparties.map((addr: string, i: number) => (
                            <div key={i}>{formatAddress(addr)}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-xs text-text-muted mt-3">
            Анализ только по Ethereum mainnet (последние 10k tx). Объяснение рисков:
            direct tx между своими = +50, общий funder = +30, +2 за каждый общий contract.
          </p>
        </GlassCard>
      )}

      {showAddForm && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-text-primary mb-4">Новый кошелёк</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Адрес кошелька</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1 block">Метка (необязательно)</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Основной, Аирдроп, DeFi..."
                className="w-full px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addWallet}
                disabled={creating || !newAddress.trim()}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Добавление...' : 'Добавить'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewAddress(''); setNewLabel('') }}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {wallets.length === 0 ? (
        <GlassCard>
          <div className="text-center py-8">
            <Wallet size={48} className="text-text-muted mx-auto mb-4 opacity-30" />
            <p className="text-text-muted">Нет кошельков</p>
            <p className="text-sm text-text-muted mt-1">Добавьте первый кошелёк для отслеживания</p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wallets.map((wallet, index) => {
            const analysis = analysisResult[wallet.address]
            const costs = costsResult[wallet.address]
            const isAnalyzing = analyzing === wallet.address
            const isCalculatingCosts = calculatingCosts === wallet.address
            const isEditing = editingId === wallet.id

            return (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet size={18} className="text-cyan-400 shrink-0" />
                        <span className="font-mono text-sm text-text-primary truncate">{formatAddress(wallet.address)}</span>
                        <button onClick={() => copyAddress(wallet.address)} className="text-text-muted hover:text-cyan-400 transition-colors shrink-0">
                          <Copy size={14} />
                        </button>
                        <a href={`https://etherscan.io/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-cyan-400 transition-colors shrink-0">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Метка..."
                            className="px-2 py-1 bg-bg-tertiary border border-white/10 rounded text-xs text-text-primary focus:outline-none focus:border-cyan-500/50"
                          />
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            placeholder="Теги через запятую..."
                            className="px-2 py-1 bg-bg-tertiary border border-white/10 rounded text-xs text-text-primary focus:outline-none focus:border-cyan-500/50 flex-1"
                          />
                          <button onClick={() => saveEdit(wallet.id)} className="text-green-400 hover:text-green-300">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} className="text-red-400 hover:text-red-300">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="cyan">{wallet.label || 'Без имени'}</Badge>
                          {wallet.tags.map((tag) => (
                            <span key={tag} className="text-xs text-text-muted flex items-center gap-1">
                              <Tag size={10} />#{tag}
                            </span>
                          ))}
                          <button onClick={() => startEdit(wallet)} className="text-text-muted hover:text-cyan-400 transition-colors ml-1">
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeWallet(wallet.id)}
                      className="p-2 text-text-muted hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-text-muted">Проекты</p>
                      <p className="text-lg font-mono text-text-primary">{wallet.projects || 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-text-muted">Завершено</p>
                      <p className="text-lg font-mono text-green-400">{wallet.completed || 0}</p>
                    </div>
                  </div>

                  {analysis && (
                    <div className="mb-4 space-y-3">
                      <div className="p-3 rounded-lg bg-bg-tertiary border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity size={16} className="text-cyan-400" />
                          <span className="text-sm font-medium text-text-primary">On-chain анализ</span>
                        </div>
                        {analysis.totalUsdValue > 0 && (
                          <div className="mb-3 p-2 rounded-md bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                            <p className="text-xs text-text-muted">Общая стоимость портфеля</p>
                            <p className="text-xl font-mono font-semibold text-cyan-300">
                              ${analysis.totalUsdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-text-muted">Баланс ETH</p>
                            <p className="text-text-primary font-mono">{parseFloat(analysis.balance || '0').toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Всего транзакций</p>
                            <p className="text-text-primary font-mono">{analysis.totalTxCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Активных сетей</p>
                            <p className="text-text-primary font-mono">{analysis.chains?.length || 0}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Возраст кошелька</p>
                            <p className="text-text-primary font-mono">
                              {analysis.walletAge
                                ? `${analysis.walletAge} дн.`
                                : analysis.firstTxDate === null
                                  ? '— (нет ETHERSCAN_API_KEY)'
                                  : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-muted">Риск-скор</p>
                            <p className="text-text-primary font-mono">{analysis.riskScore || 0}/100</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Токенов</p>
                            <p className="text-text-primary font-mono">{analysis.totalTokenValue || 0}</p>
                          </div>
                        </div>
                      </div>

                      {analysis.chains?.some((c: any) => (c.tokens?.length || 0) > 0 || c.nativeUsd > 0) && (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-white/10 space-y-2">
                          {analysis.chains.filter((c: any) => (c.tokens?.length || 0) > 0 || c.nativeUsd > 0).map((c: any) => (
                            <div key={c.chain}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-text-muted uppercase tracking-wide">{c.chain}</span>
                                {c.chainUsd > 0 && (
                                  <span className="text-xs font-mono text-cyan-300">
                                    ${c.chainUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {c.tokens?.map((t: any, i: number) => (
                                  <span key={i} className="px-2 py-1 text-xs bg-white/5 rounded-md text-text-secondary" title={t.contractAddress}>
                                    {t.symbol}: {parseFloat(t.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                                    {t.usdValue > 0 && (
                                      <span className="ml-1 text-cyan-400/70">(${t.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {analysis.defiPositions?.length > 0 && (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-white/10">
                          <p className="text-xs text-text-muted mb-2">DeFi Позиции:</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.defiPositions.map((p: any, i: number) => (
                              <span key={i} className="px-2 py-1 text-xs bg-purple-500/10 text-purple-400 rounded-md border border-purple-500/20">
                                {p.protocol}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.recommendations?.length > 0 && (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-white/10">
                          <p className="text-xs text-text-muted mb-1">Рекомендации:</p>
                          {analysis.recommendations.map((rec: string, i: number) => (
                            <p key={i} className="text-xs text-yellow-400">• {rec}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {costs && (
                    <div className="mb-4 space-y-2">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame size={16} className="text-orange-400" />
                          <span className="text-sm font-medium text-text-primary">Потрачено на газ</span>
                        </div>
                        <p className="text-2xl font-mono font-semibold text-orange-300">
                          ${costs.totalUsd?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {costs.totalTxCount || 0} исходящих tx
                          {costs.totalFailedCount > 0 && (
                            <span className="text-red-400"> · {costs.totalFailedCount} провалены</span>
                          )}
                          {costs.truncated && <span className="text-yellow-400"> · видны только последние 10k tx</span>}
                        </p>
                        {analysis?.totalUsdValue > 0 && (
                          <p className="text-xs mt-2 pt-2 border-t border-white/5">
                            <span className="text-text-muted">Портфель / расходы:</span>{' '}
                            <span className={costs.totalUsd > 0 && analysis.totalUsdValue / costs.totalUsd >= 1 ? 'text-green-400' : 'text-red-400'}>
                              {costs.totalUsd > 0 ? `${(analysis.totalUsdValue / costs.totalUsd).toFixed(1)}x` : '∞'}
                            </span>
                          </p>
                        )}
                      </div>
                      {costs.breakdown?.length > 0 && (
                        <div className="p-3 rounded-lg bg-bg-tertiary border border-white/10 space-y-1.5">
                          {costs.breakdown.map((b: any) => (
                            <div key={b.chain} className="flex items-center justify-between text-xs">
                              <span className="text-text-muted uppercase tracking-wide">{b.chain}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-text-secondary font-mono">
                                  {b.nativeAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} {b.nativeSymbol}
                                </span>
                                <span className="text-orange-300 font-mono w-20 text-right">
                                  ${b.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-text-muted w-12 text-right">{b.txCount} tx</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {wallet.eligibility && wallet.eligibility.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-2">Оценка элиджиблити (ИИ):</p>
                      <div className="space-y-2">
                        {wallet.eligibility.map((item) => (
                          <div key={item.project} className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary w-20">{item.project}</span>
                            <ProgressBar
                              progress={item.score}
                              color={item.score >= 70 ? 'green' : item.score >= 40 ? 'yellow' : 'red'}
                            />
                            <span className="text-xs font-mono text-text-muted w-10 text-right">{item.score}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => analyzeWallet(wallet.address)}
                      disabled={isAnalyzing}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Анализ...
                        </>
                      ) : (
                        <>
                          <Activity size={16} />
                          On-chain анализ
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => calculateCosts(wallet.address)}
                      disabled={isCalculatingCosts}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50 text-sm"
                    >
                      {isCalculatingCosts ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Счёт...
                        </>
                      ) : (
                        <>
                          <Flame size={16} />
                          Расходы
                        </>
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        setEligibilityLoading(wallet.address)
                        try {
                          const res = await fetch('/api/wallets/eligibility', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ address: wallet.address }),
                          })
                          const data = await res.json()
                          if (res.ok) setEligibilityResults((prev) => ({ ...prev, [wallet.address]: data }))
                        } finally {
                          setEligibilityLoading(null)
                        }
                      }}
                      disabled={eligibilityLoading === wallet.address}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
                    >
                      {eligibilityLoading === wallet.address ? (
                        <><Loader2 size={16} className="animate-spin" />Проверка...</>
                      ) : (
                        <><Check size={16} />Eligibility</>
                      )}
                    </button>
                  </div>

                  {/* Eligibility Results */}
                  {eligibilityResults[wallet.address] && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Check size={14} className="text-green-400" />
                        <span className="text-xs font-medium text-text-primary">Eligibility по проектам</span>
                        <span className="text-[10px] text-text-muted ml-auto">
                          {eligibilityResults[wallet.address].wallet_summary.totalTxCount} tx · {eligibilityResults[wallet.address].wallet_summary.walletAge}д · {eligibilityResults[wallet.address].wallet_summary.chainsActive} сетей
                        </span>
                      </div>
                      <div className="space-y-2">
                        {(eligibilityResults[wallet.address].eligibility as { projectName: string; score: number; rulesMet: number; rulesTotal: number; missing: string[] }[]).map((e) => (
                          <div key={e.projectName} className="flex items-center gap-3">
                            <span className="text-xs text-text-primary w-20 truncate">{e.projectName}</span>
                            <div className="flex-1">
                              <ProgressBar
                                progress={e.score}
                                color={e.score >= 80 ? 'green' : e.score >= 50 ? 'cyan' : 'red'}
                              />
                            </div>
                            <span className={`text-xs font-mono w-8 text-right ${e.score >= 80 ? 'text-green-400' : e.score >= 50 ? 'text-cyan-400' : 'text-red-400'}`}>
                              {e.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
