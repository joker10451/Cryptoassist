'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { formatAddress } from '@/lib/utils'
import Link from 'next/link'

type WalletData = {
  id: string
  address: string
  label: string | null
  tags: string[]
}

export function WalletOverview() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/wallets')
      .then((r) => r.json())
      .then((data) => {
        setWallets(data)
        setLoading(false)
      })
      .catch(() => {
        setWallets([])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="text-cyan-400" size={20} />
            <h2 className="text-lg font-semibold text-text-primary">Обзор кошельков</h2>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="text-cyan-400" size={20} />
          <h2 className="text-lg font-semibold text-text-primary">Обзор кошельков</h2>
          <span className="text-sm text-text-muted">({wallets.length})</span>
        </div>
        <Link href="/wallets" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
          <Plus size={12} />
          Добавить
        </Link>
      </div>
      {wallets.length === 0 ? (
        <div className="text-center py-6">
          <Wallet size={32} className="text-text-muted mx-auto mb-2 opacity-30" />
          <p className="text-sm text-text-muted">Нет кошельков</p>
          <Link href="/wallets" className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-block">
            Добавить первый кошелёк →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.slice(0, 3).map((wallet, index) => (
            <motion.div
              key={wallet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-text-primary">
                      {formatAddress(wallet.address)}
                    </span>
                    {wallet.label && (
                      <span className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-md border border-cyan-500/30">
                        {wallet.label}
                      </span>
                    )}
                  </div>
                  {wallet.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      {wallet.tags.map((tag) => (
                        <span key={tag} className="text-xs text-text-muted">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {wallets.length > 3 && (
            <Link href="/wallets" className="text-xs text-cyan-400 hover:text-cyan-300 block text-center mt-2">
              Ещё {wallets.length - 3} кошелька →
            </Link>
          )}
        </div>
      )}
    </GlassCard>
  )
}
