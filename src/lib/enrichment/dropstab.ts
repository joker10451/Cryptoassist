/**
 * DropsTab API client (Builders Program).
 *
 * Endpoints:
 *   GET /coins — list/search coins
 *   GET /coins/{id} — coin detail
 *   GET /fundingRounds — funding rounds with investors
 *   GET /tokenUnlocks/overview — upcoming unlocks
 *   GET /activities — airdrops, listings, partnerships
 *
 * Auth: x-api-key header.
 * Rate: ~500 req/day (Builders plan).
 */

const BASE = 'https://api.dropstab.com/api/v1'
const API_KEY = () => process.env.DROPSTAB_API_KEY || ''

async function dtFetch<T>(path: string, timeoutMs = 12000): Promise<T | null> {
  const key = API_KEY()
  if (!key) return null

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        Accept: 'application/json',
        'x-api-key': key,
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[dropstab] ${res.status} ${path}`)
      }
      return null
    }
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(id)
  }
}

// --- Funding Rounds --------------------------------------------------------

export interface FundingRound {
  id: string | number
  projectName?: string
  projectSlug?: string
  roundType?: string
  amount?: number // USD
  date?: string
  leadInvestors?: string[]
  investors?: string[]
  valuation?: number
}

interface FundingResponse {
  data?: FundingRound[]
  items?: FundingRound[]
}

export async function searchFundingRounds(projectName: string): Promise<FundingRound[]> {
  const data = await dtFetch<FundingResponse>(
    `/fundingRounds?search=${encodeURIComponent(projectName)}&limit=10`,
  )
  return data?.data ?? data?.items ?? []
}

export function aggregateFunding(rounds: FundingRound[]): {
  total_usd: number
  investors: string[]
  rounds_count: number
} {
  let total = 0
  const investors = new Set<string>()
  for (const r of rounds) {
    if (typeof r.amount === 'number') total += r.amount
    for (const i of r.leadInvestors ?? []) if (i) investors.add(i.trim())
    for (const i of r.investors ?? []) if (i) investors.add(i.trim())
  }
  return { total_usd: total, investors: Array.from(investors), rounds_count: rounds.length }
}

// --- Token Unlocks ---------------------------------------------------------

export interface TokenUnlock {
  id: string | number
  projectName?: string
  tokenSymbol?: string
  unlockDate?: string
  amount?: number
  percentOfSupply?: number
  type?: string
}

interface UnlocksResponse {
  data?: TokenUnlock[]
  items?: TokenUnlock[]
}

export async function getUpcomingUnlocks(limit = 20): Promise<TokenUnlock[]> {
  const data = await dtFetch<UnlocksResponse>(`/tokenUnlocks/overview?limit=${limit}`)
  return data?.data ?? data?.items ?? []
}

// --- Activities (airdrops, listings, etc) ----------------------------------

export interface CryptoActivity {
  id: string | number
  projectName?: string
  type?: string // airdrop, listing, partnership, upgrade, etc
  title?: string
  description?: string
  date?: string
  status?: string
}

interface ActivitiesResponse {
  data?: CryptoActivity[]
  items?: CryptoActivity[]
}

export async function getActivities(opts: {
  status?: 'upcoming' | 'active' | 'ended'
  limit?: number
} = {}): Promise<CryptoActivity[]> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  params.set('limit', String(opts.limit ?? 20))
  const data = await dtFetch<ActivitiesResponse>(`/activities?${params.toString()}`)
  return data?.data ?? data?.items ?? []
}

// --- Coin search -----------------------------------------------------------

export interface DropstabCoin {
  id: string | number
  name?: string
  symbol?: string
  slug?: string
}

interface CoinsResponse {
  data?: DropstabCoin[]
  items?: DropstabCoin[]
}

export async function searchCoins(query: string): Promise<DropstabCoin[]> {
  const data = await dtFetch<CoinsResponse>(`/coins?search=${encodeURIComponent(query)}&limit=5`)
  return data?.data ?? data?.items ?? []
}

/**
 * Проверка доступности API (health check).
 */
export async function isDropstabAvailable(): Promise<boolean> {
  const key = API_KEY()
  if (!key) return false
  try {
    const res = await fetch(`${BASE}/coins?limit=1`, {
      headers: { 'x-api-key': key, Accept: 'application/json' },
    })
    return res.ok
  } catch {
    return false
  }
}
