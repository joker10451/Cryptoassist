/**
 * CoinGecko Public API client.
 * Бесплатный, без ключа, лимит ~30 req/min для public endpoint.
 *
 * Используем для:
 *  - resolution name → coin id (через /search)
 *  - fetch deep data о монете (/coins/{id})
 *
 * Толерантный: если 404 / rate limit — возвращает null, не бросает.
 */

const BASE = 'https://api.coingecko.com/api/v3'

interface SearchHit {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
}

export interface CoinGeckoData {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
  market_cap_usd: number | null
  total_volume_usd: number | null
  current_price_usd: number | null
  price_change_24h_pct: number | null
  twitter_followers: number | null
  github_repos: string[]
  homepage: string | null
  categories: string[]
  description_en: string | null
  asset_platform_id: string | null
  /** какие сети поддерживает токен (chainName из platforms) */
  chains: string[]
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  // Один retry при 429 (rate limit) с back-off 2.5s.
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2500))
        continue
      }
      if (!res.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[coingecko] ${res.status} ${url}`)
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
  return null
}

/**
 * Найти монету по name/slug. Возвращает топ-3 хита.
 */
export async function searchCoinGecko(query: string): Promise<SearchHit[]> {
  const data = await fetchJson<{ coins?: SearchHit[] }>(
    `${BASE}/search?query=${encodeURIComponent(query)}`,
  )
  return (data?.coins ?? []).slice(0, 3)
}

interface CoinGeckoRaw {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
  description?: { en?: string }
  links?: {
    homepage?: string[]
    repos_url?: { github?: string[] }
    twitter_screen_name?: string
  }
  categories?: string[]
  asset_platform_id?: string | null
  platforms?: Record<string, string>
  community_data?: {
    twitter_followers?: number | null
  }
  market_data?: {
    market_cap?: { usd?: number }
    total_volume?: { usd?: number }
    current_price?: { usd?: number }
    price_change_percentage_24h?: number
  }
}

export async function getCoinGeckoData(id: string): Promise<CoinGeckoData | null> {
  const raw = await fetchJson<CoinGeckoRaw>(
    `${BASE}/coins/${encodeURIComponent(
      id,
    )}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`,
    10_000,
  )
  if (!raw) return null

  const platforms = raw.platforms ?? {}
  const chains = Object.keys(platforms).filter((k) => k && platforms[k])

  return {
    id: raw.id,
    name: raw.name,
    symbol: (raw.symbol ?? '').toUpperCase(),
    market_cap_rank: raw.market_cap_rank ?? null,
    market_cap_usd: raw.market_data?.market_cap?.usd ?? null,
    total_volume_usd: raw.market_data?.total_volume?.usd ?? null,
    current_price_usd: raw.market_data?.current_price?.usd ?? null,
    price_change_24h_pct: raw.market_data?.price_change_percentage_24h ?? null,
    twitter_followers: raw.community_data?.twitter_followers ?? null,
    github_repos: (raw.links?.repos_url?.github ?? []).filter(Boolean),
    homepage: (raw.links?.homepage ?? []).filter(Boolean)[0] ?? null,
    categories: (raw.categories ?? []).filter(Boolean) as string[],
    description_en: raw.description?.en ?? null,
    asset_platform_id: raw.asset_platform_id ?? null,
    chains,
  }
}
