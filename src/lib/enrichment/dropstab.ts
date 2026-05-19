/**
 * DropsTab API client (Builders Program / Advanced plan).
 *
 * Host: public-api.dropstab.com
 * Auth: x-dropstab-api-key header
 * Format: { status, data: { content: [...], totalSize, ... }, failure, failureDetails }
 * Rate: 500k requests / 30 days.
 */

const BASE = 'https://public-api.dropstab.com/api/v1'
const API_KEY = () => process.env.DROPSTAB_API_KEY || ''

interface PageEnvelope<T> {
  status: string
  failure: boolean
  failureDetails: unknown
  data?: {
    content?: T[]
    totalSize?: number
    pageSize?: number
    currentPage?: number
  }
}

async function dtFetch<T>(path: string, timeoutMs = 12000): Promise<T[]> {
  const key = API_KEY()
  if (!key) return []

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        'x-dropstab-api-key': key,
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[dropstab] ${res.status} ${path}`)
      }
      return []
    }
    const env = (await res.json()) as PageEnvelope<T>
    return env.data?.content ?? []
  } catch {
    return []
  } finally {
    clearTimeout(id)
  }
}

// --- Coin search -----------------------------------------------------------

export interface DropstabCoin {
  id: number | string
  name?: string
  symbol?: string
  slug?: string
  rank?: number
  image?: string
  trading?: string
}

/** Поиск по name/symbol/slug. */
export async function searchCoins(query: string): Promise<DropstabCoin[]> {
  return dtFetch<DropstabCoin>(`/coins/search?query=${encodeURIComponent(query)}&size=10`)
}

// --- Funding Rounds --------------------------------------------------------

interface DropstabInvestor {
  id?: number
  name?: string
  investorSlug?: string
  ventureType?: string
  tier?: string
  lead?: boolean
}

export interface FundingRound {
  id: number
  coinSlug?: string
  coinSymbol?: string
  fundsRaised?: number
  preValuation?: number
  preValuationInaccurate?: boolean
  stage?: string
  investors?: DropstabInvestor[]
  twitterPerformance?: number | null
  category?: string | null
  date?: string
}

/**
 * Получить раунды финансирования по точному slug проекта (например "monad").
 * Если slug неизвестен — используй searchCoins() и возьми поле slug.
 */
export async function getFundingRoundsBySlug(coinSlug: string): Promise<FundingRound[]> {
  if (!coinSlug) return []
  return dtFetch<FundingRound>(
    `/fundingRounds?coinSlug=${encodeURIComponent(coinSlug)}&size=50`,
  )
}

/**
 * Fuzzy-search раундов по имени проекта (через ?search=).
 * Менее точный — может вернуть нерелевантные совпадения.
 */
export async function searchFundingRounds(name: string): Promise<FundingRound[]> {
  return dtFetch<FundingRound>(`/fundingRounds?search=${encodeURIComponent(name)}&size=20`)
}

export function aggregateFunding(rounds: FundingRound[]): {
  total_usd: number
  investors: string[]
  rounds_count: number
  top_tier_count: number
} {
  let total = 0
  const investors = new Set<string>()
  let topTier = 0
  for (const r of rounds) {
    if (typeof r.fundsRaised === 'number') total += r.fundsRaised
    for (const i of r.investors ?? []) {
      if (i?.name) investors.add(i.name.trim())
      if (i?.tier === 'Tier 1') topTier++
    }
  }
  return {
    total_usd: total,
    investors: Array.from(investors),
    rounds_count: rounds.length,
    top_tier_count: topTier,
  }
}

// --- Health check ----------------------------------------------------------

export async function isDropstabAvailable(): Promise<boolean> {
  const key = API_KEY()
  if (!key) return false
  try {
    const res = await fetch(`${BASE}/coins/supported?size=1`, {
      headers: { 'x-dropstab-api-key': key, Accept: 'application/json' },
    })
    return res.ok
  } catch {
    return false
  }
}
