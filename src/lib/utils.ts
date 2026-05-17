import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return `$${value.toFixed(0)}`
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function getProbabilityColor(score: number): string {
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-cyan-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

export function getProbabilityBg(score: number): string {
  if (score >= 85) return 'bg-green-500/10 border-green-500/30'
  if (score >= 70) return 'bg-cyan-500/10 border-cyan-500/30'
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'text-yellow-400'
    case 'epic': return 'text-purple-400'
    case 'rare': return 'text-cyan-400'
    case 'uncommon': return 'text-green-400'
    default: return 'text-text-secondary'
  }
}

export function getLevelTitle(level: number): string {
  if (level >= 50) return 'Легенда'
  if (level >= 40) return 'Мастер-охотник'
  if (level >= 30) return 'Элитный охотник'
  if (level >= 20) return 'Про-охотник'
  if (level >= 10) return 'Охотник'
  if (level >= 5) return 'Разведчик'
  return 'Новичок'
}
