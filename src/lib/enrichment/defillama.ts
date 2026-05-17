/**
 * DefiLlama Public API client.
 * Бесплатно, без ключа.
 *
 * Используем:
 *  - GET /protocols           → найти slug
 *  - GET /protocol/{slug}     → детали (TVL, chains, twitter, etc)
 *  - GET /raises              → funding rounds (исторические + свежие)
 */

const BASE = 'https://api.llama.fi'

export interface DefiLlamaProtocolLite {
  id?: string
  name: string
  slug: string
  category?: string | null
  chains?: string[]
  tvl?: number | null
  url?: string | null
  twitter?: string | null
  description?: string | null
  symbol?: string | null
  /** Раунды финансирования вшиты внутри детальной выдачи */
  raises?: DefiLlamaRaise[]
}

export interface DefiLlamaRaise {
  date: number // unix seconds
  name: string
  round?: string
  amount?: number // млн долларов в их формате — ниже нормализуем в USD
  chains?: string[]
  sector?: string
  category?: string
  source?: string
  leadInvestors?: string[]
  otherInvestors?: string[]
  valuation?: number
  defillamaId?: string
}

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(id)
  }
}

// --- Chains ----------------------------------------------------------------

export interface DefiLlamaChain {
  name: string
  gecko_id: string | null
  tvl: number | null
  tokenSymbol: string | null
  /** chain-level URL отсутствует, держим null. */
}

let chainsCache: { at: number; list: DefiLlamaChain[] } | null = null
const CHAINS_TTL_MS = 30 * 60 * 1000

interface ChainRaw {
  name: string
  gecko_id?: string | null
  tvl?: number | null
  tokenSymbol?: string | null
}

export async function listAllChains(): Promise<DefiLlamaChain[]> {
  if (chainsCache && Date.now() - chainsCache.at < CHAINS_TTL_MS) return chainsCache.list
  const data = (await fetchJson<ChainRaw[]>(`${BASE}/chains`)) ?? []
  const list: DefiLlamaChain[] = data.map((c) => ({
    name: c.name,
    gecko_id: c.gecko_id ?? null,
    tvl: c.tvl ?? null,
    tokenSymbol: c.tokenSymbol ?? null,
  }))
  chainsCache = { at: Date.now(), list }
  return list
}

export async function findChain(query: string): Promise<DefiLlamaChain | null> {
  const list = await listAllChains()
  if (list.length === 0) return null
  const q = query.toLowerCase()
  return (
    list.find((c) => c.name.toLowerCase() === q) ??
    list.find((c) => c.name.toLowerCase().includes(q)) ??
    null
  )
}

/**
 * Список всех протоколов. Тяжёлый запрос (~3 МБ), но отдаётся целиком,
 * поэтому кешируем на весь lifetime процесса.
 */
let allProtocolsCache: { at: number; list: DefiLlamaProtocolLite[] } | null = null
const PROTOCOLS_TTL_MS = 30 * 60 * 1000

export async function listAllProtocols(): Promise<DefiLlamaProtocolLite[]> {
  if (allProtocolsCache && Date.now() - allProtocolsCache.at < PROTOCOLS_TTL_MS) {
    return allProtocolsCache.list
  }
  const list = (await fetchJson<DefiLlamaProtocolLite[]>(`${BASE}/protocols`)) ?? []
  allProtocolsCache = { at: Date.now(), list }
  return list
}

export async function findProtocol(query: string): Promise<DefiLlamaProtocolLite | null> {
  const list = await listAllProtocols()
  if (list.length === 0) return null
  const q = query.toLowerCase()

  // Точное совпадение по slug, потом по name, потом partial.
  // Игнорируем записи без slug — они нам бесполезны (детальный endpoint требует slug).
  const withSlug = list.filter((p): p is DefiLlamaProtocolLite & { slug: string } => !!p.slug)
  return (
    withSlug.find((p) => p.slug.toLowerCase() === q) ??
    withSlug.find((p) => p.name?.toLowerCase() === q) ??
    withSlug.find(
      (p) => p.slug.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q),
    ) ??
    null
  )
}

interface ProtocolDetailRaw {
  id?: string
  name: string
  slug: string
  category?: string
  description?: string
  url?: string
  twitter?: string
  chains?: string[]
  currentChainTvls?: Record<string, number>
  tvl?: number | { totalLiquidityUSD?: number }[] | null
  raises?: DefiLlamaRaise[]
}

export async function getProtocolDetail(slug: string): Promise<DefiLlamaProtocolLite | null> {
  const raw = await fetchJson<ProtocolDetailRaw>(
    `${BASE}/protocol/${encodeURIComponent(slug)}`,
  )
  if (!raw) return null

  // tvl может прийти числом или массивом (timeseries) — для мгновенного значения
  // лучше брать суммарный currentChainTvls
  const tvl =
    typeof raw.tvl === 'number'
      ? raw.tvl
      : raw.currentChainTvls
        ? Object.values(raw.currentChainTvls).reduce((s, v) => s + (Number(v) || 0), 0)
        : null

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    category: raw.category ?? null,
    chains: raw.chains ?? [],
    tvl,
    url: raw.url ?? null,
    twitter: raw.twitter ?? null,
    description: raw.description ?? null,
    raises: raw.raises ?? [],
  }
}

/**
 * Все raises целиком. Тоже кешируем — выдача ~1 МБ.
 *
 * ⚠️ DefiLlama сделала /raises платным (требует API plan).
 * Мы пробуем один раз, если получаем не-OK — кешируем пустой список и больше не дёргаем.
 */
let raisesCache: { at: number; list: DefiLlamaRaise[]; paid_locked?: boolean } | null = null
const RAISES_TTL_MS = 60 * 60 * 1000

export async function listAllRaises(): Promise<DefiLlamaRaise[]> {
  if (raisesCache) {
    if (raisesCache.paid_locked) return []
    if (Date.now() - raisesCache.at < RAISES_TTL_MS) return raisesCache.list
  }
  const res = await fetch(`${BASE}/raises`, { headers: { Accept: 'application/json' } }).catch(
    () => null,
  )
  if (!res || !res.ok) {
    // 402/403/404 — фриплан закрыт, помечаем lock и возвращаем пусто
    raisesCache = { at: Date.now(), list: [], paid_locked: true }
    return []
  }
  let list: DefiLlamaRaise[] = []
  try {
    const data = (await res.json()) as { raises?: DefiLlamaRaise[] }
    list = data?.raises ?? []
  } catch {
    raisesCache = { at: Date.now(), list: [], paid_locked: true }
    return []
  }
  raisesCache = { at: Date.now(), list }
  return list
}

/**
 * Найти все раунды по имени проекта. Имя матчим точно (case-insensitive).
 * Если есть defillamaId — фильтруем дополнительно по нему.
 */
export async function findRaises(name: string, defillamaId?: string): Promise<DefiLlamaRaise[]> {
  const all = await listAllRaises()
  const n = name.toLowerCase().trim()
  const matches = all.filter(
    (r) =>
      r.name?.toLowerCase() === n ||
      (defillamaId && r.defillamaId === defillamaId),
  )
  // sort: новые сверху
  return matches.sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
}

/**
 * Аггрегатор: total funding USD + список всех уникальных инвесторов.
 * raises[].amount у DefiLlama в МИЛЛИОНАХ долларов, конвертируем в USD.
 */
export function aggregateRaises(raises: DefiLlamaRaise[]): {
  total_usd: number
  investors: string[]
  rounds: number
} {
  let total = 0
  const investors = new Set<string>()
  for (const r of raises) {
    if (typeof r.amount === 'number') total += r.amount * 1_000_000
    for (const i of r.leadInvestors ?? []) if (i) investors.add(i.trim())
    for (const i of r.otherInvestors ?? []) if (i) investors.add(i.trim())
  }
  return {
    total_usd: total,
    investors: Array.from(investors),
    rounds: raises.length,
  }
}
