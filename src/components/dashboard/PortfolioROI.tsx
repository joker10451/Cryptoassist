'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Flame, Trophy, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'

interface PerWallet {
  address: string
  label: string | null
  totalUsd: number
  txCount: number
  computedAt: string | null
}

interface ROIData {
  walletsTotal: number
  walletsWithData: number
  perWallet: PerWallet[]
  totalCostUsd: number
  totalTxCount: number
  totalFailedCount: number
  projectsActive: number
  expectedRewardMin: number
  expectedRewardMax: number
  roiMin: number | null
  roiMax: number | null
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`
}

export function PortfolioROI() {
  const [data, setData] = useState<ROIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchROI = async () => {
    try {
      const res = await fetch('/api/portfolio/roi')
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.error('Fetch ROI error:', e)
    } finally {
      setLoading(false)
    }
  }

  const refreshAll = async () => {
    if (!data?.perWallet?.length) return
    setRefreshing(true)
    try {
      await Promise.allSettled(
        data.perWallet.map((w) =>
          fetch('/api/onchain/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: w.address }),
          })
        )
      )
      await fetchROI()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchROI()
  }, [])

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="text-text-muted animate-spin" size={20} />
        </div>
      </GlassCard>
    )
  }

  if (!data || data.walletsTotal === 0) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="text-cyan-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Портфель / ROI</h2>
        </div>
        <p className="text-sm text-text-muted">Нет кошельков для анализа</p>
      </GlassCard>
    )
  }

  const noCosts = data.walletsWithData === 0

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-cyan-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Портфель / ROI</h2>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          title="Пересчитать расходы для всех кошельков"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {noCosts ? (
        <div className="text-center py-4">
          <AlertCircle className="text-text-muted mx-auto mb-2" size={24} />
          <p className="text-sm text-text-muted mb-2">Расходы ещё не считались</p>
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/30 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Считаю…' : `Посчитать (${data.walletsTotal} кошельков)`}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Flame size={12} className="text-orange-400" />
                <span className="text-xs text-text-muted">Расходы</span>
              </div>
              <p className="text-xl font-bold font-mono text-orange-300">{formatUsd(data.totalCostUsd)}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {data.totalTxCount} tx
                {data.totalFailedCount > 0 && (
                  <span className="text-red-400"> · {data.totalFailedCount} fail</span>
                )}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy size={12} className="text-green-400" />
                <span className="text-xs text-text-muted">Ожидаемо</span>
              </div>
              <p className="text-xl font-bold font-mono text-green-300">
                {formatUsd(data.expectedRewardMin)}–{formatUsd(data.expectedRewardMax)}
              </p>
              <p className="text-xs text-text-muted mt-0.5">{data.projectsActive} проектов</p>
            </motion.div>
          </div>

          {data.roiMin !== null && data.roiMax !== null && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
              <p className="text-xs text-text-muted mb-1">Потенциальный ROI</p>
              <p className="text-2xl font-bold font-mono text-cyan-300">
                {data.roiMin.toFixed(1)}x – {data.roiMax.toFixed(1)}x
              </p>
              <p className="text-xs text-text-muted mt-1">
                Средний:{' '}
                <span className="text-text-secondary">
                  {((data.roiMin + data.roiMax) / 2).toFixed(1)}x
                </span>
              </p>
            </div>
          )}

          {data.walletsWithData < data.walletsTotal && (
            <p className="text-xs text-yellow-400/80 mt-2">
              Данные есть для {data.walletsWithData} из {data.walletsTotal} кошельков
            </p>
          )}
        </>
      )}
    </GlassCard>
  )
}
