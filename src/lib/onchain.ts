import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem'
import { mainnet, arbitrum, optimism, polygon, base, bsc } from 'viem/chains'

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || ''
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || ''

function alchemyRpc(subdomain: string) {
  return ALCHEMY_KEY ? `https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_KEY}` : null
}

const chains = {
  ethereum: { chain: mainnet, rpc: alchemyRpc('eth-mainnet') || process.env.NEXT_PUBLIC_ETHEREUM_RPC || mainnet.rpcUrls.default.http[0], chainId: 1, alchemy: alchemyRpc('eth-mainnet') },
  arbitrum: { chain: arbitrum, rpc: alchemyRpc('arb-mainnet') || process.env.NEXT_PUBLIC_ARBITRUM_RPC || arbitrum.rpcUrls.default.http[0], chainId: 42161, alchemy: alchemyRpc('arb-mainnet') },
  optimism: { chain: optimism, rpc: alchemyRpc('opt-mainnet') || process.env.NEXT_PUBLIC_OPTIMISM_RPC || optimism.rpcUrls.default.http[0], chainId: 10, alchemy: alchemyRpc('opt-mainnet') },
  polygon: { chain: polygon, rpc: alchemyRpc('polygon-mainnet') || process.env.NEXT_PUBLIC_POLYGON_RPC || polygon.rpcUrls.default.http[0], chainId: 137, alchemy: alchemyRpc('polygon-mainnet') },
  base: { chain: base, rpc: alchemyRpc('base-mainnet') || process.env.NEXT_PUBLIC_BASE_RPC || base.rpcUrls.default.http[0], chainId: 8453, alchemy: alchemyRpc('base-mainnet') },
  bsc: { chain: bsc, rpc: process.env.NEXT_PUBLIC_BSC_RPC || bsc.rpcUrls.default.http[0], chainId: 56, alchemy: null as string | null },
}

const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
])

const topTokensByChain: Record<string, { address: string; symbol: string; decimals: number }[]> = {
  ethereum: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
  ],
  arbitrum: [
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', decimals: 6 },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
  ],
  optimism: [
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  polygon: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', decimals: 6 },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18 },
  ],
  base: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  bsc: [
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', decimals: 18 },
  ],
}

type ChainName = keyof typeof chains
type AlchemyTokenBalance = { tokenBalance: string | null; contractAddress: string }
type AlchemyTokenMetadata = { symbol?: string | null; decimals?: number | null }
type AlchemyPriceItem = {
  network?: string
  symbol?: string
  address?: string
  prices?: { currency?: string; value?: string }[]
}

// PublicClient generic зависит от chain — кэш храним как unknown,
// при чтении возвращаем напрямую созданный клиент (тип выводится из createPublicClient).
const clientCache = new Map<string, unknown>()

function getClient(chainName: string) {
  const config = chains[chainName as ChainName]
  if (!config) throw new Error(`Unknown chain: ${chainName}`)
  const cached = clientCache.get(chainName)
  if (cached) return cached as ReturnType<typeof createPublicClient>
  const client = createPublicClient({ chain: config.chain, transport: http(config.rpc) })
  clientCache.set(chainName, client)
  return client
}

export interface TokenBalance {
  symbol: string
  balance: string
  contractAddress?: string
  usdValue?: number
}

export interface WalletActivity {
  chain: string
  txCount: number
  nativeBalance: string
  nativeUsd?: number
  tokens: TokenBalance[]
  chainUsd?: number
}

export interface WalletAnalysis {
  address: string
  balance: string
  chains: WalletActivity[]
  totalTxCount: number
  walletAge: number
  riskScore: number
  recommendations: string[]
  defiPositions: { protocol: string; chain: string; usd?: number }[]
  totalTokenValue: number
  totalUsdValue: number
  firstTxDate: string | null
}

const alchemyNetworkSlug: Record<string, string> = {
  ethereum: 'eth-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  base: 'base-mainnet',
  bsc: 'bnb-mainnet',
}

const nativeSymbolByChain: Record<string, string> = {
  ethereum: 'ETH',
  arbitrum: 'ETH',
  optimism: 'ETH',
  polygon: 'POL',
  base: 'ETH',
  bsc: 'BNB',
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  return Promise.race([promise, timeout])
}

async function alchemyCall<T = unknown>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`Alchemy ${method} ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.result as T
}

async function getAlchemyTokens(address: string, alchemyUrl: string): Promise<TokenBalance[]> {
  try {
    const balances = await withTimeout(
      alchemyCall<{ tokenBalances?: AlchemyTokenBalance[] }>(alchemyUrl, 'alchemy_getTokenBalances', [address, 'erc20']),
      8000
    )
    if (!balances?.tokenBalances) return []

    const nonZero = balances.tokenBalances.filter((t) => {
      if (!t.tokenBalance) return false
      try { return BigInt(t.tokenBalance) > BigInt(0) } catch { return false }
    })
    if (nonZero.length === 0) return []

    const top = nonZero.slice(0, 25)
    const metadataResults = await Promise.allSettled(
      top.map((t) =>
        withTimeout(
          alchemyCall<AlchemyTokenMetadata>(alchemyUrl, 'alchemy_getTokenMetadata', [t.contractAddress]),
          4000,
        ),
      ),
    )

    const tokens: TokenBalance[] = []
    metadataResults.forEach((r, i) => {
      if (r.status !== 'fulfilled' || !r.value) return
      const meta = r.value
      if (!meta.symbol || meta.decimals == null) return
      const tokenBalance = top[i].tokenBalance
      if (!tokenBalance) return
      try {
        const balance = formatUnits(BigInt(tokenBalance), meta.decimals)
        if (parseFloat(balance) > 0) {
          tokens.push({ symbol: meta.symbol, balance, contractAddress: top[i].contractAddress })
        }
      } catch {}
    })
    return tokens
  } catch {
    return []
  }
}

export async function getWalletBalance(address: string, chainName: string = 'ethereum'): Promise<string> {
  try {
    const client = getClient(chainName)
    const balance = await client.getBalance({ address: address as `0x${string}` })
    return formatEther(balance)
  } catch {
    return '0'
  }
}

export async function getTransactionCount(address: string, chainName: string = 'ethereum'): Promise<number> {
  try {
    const client = getClient(chainName)
    const count = await client.getTransactionCount({ address: address as `0x${string}` })
    return Number(count)
  } catch {
    return 0
  }
}

async function getTokenBalancesViem(address: string, chainName: string): Promise<TokenBalance[]> {
  const tokens = topTokensByChain[chainName] || []
  if (tokens.length === 0) return []

  const client = getClient(chainName)
  const results = await Promise.allSettled(
    tokens.map((token) =>
      withTimeout(
        client.readContract({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
        3000
      ).then((balance) => ({ token, balance }))
    )
  )

  const out: TokenBalance[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.balance || (r.value.balance as bigint) === BigInt(0)) continue
    out.push({
      symbol: r.value.token.symbol,
      balance: formatUnits(r.value.balance as bigint, r.value.token.decimals),
      contractAddress: r.value.token.address,
    })
  }
  return out
}

async function getTokenBalances(address: string, chainName: string): Promise<TokenBalance[]> {
  const config = chains[chainName as keyof typeof chains]
  if (config?.alchemy) {
    const fromAlchemy = await getAlchemyTokens(address, config.alchemy)
    if (fromAlchemy.length > 0) return fromAlchemy
  }
  return getTokenBalancesViem(address, chainName)
}

async function getTokenPricesUSD(
  pairs: { network: string; address: string }[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!ALCHEMY_KEY || pairs.length === 0) return out

  const chunks: { network: string; address: string }[][] = []
  for (let i = 0; i < pairs.length; i += 25) chunks.push(pairs.slice(i, i + 25))

  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      withTimeout(
        fetch(`https://api.g.alchemy.com/prices/v1/${ALCHEMY_KEY}/tokens/by-address`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: chunk }),
        }).then((r) => (r.ok ? r.json() : null)),
        6000
      )
    )
  )

  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue
    const data = (r.value as { data?: AlchemyPriceItem[] }).data ?? []
    for (const item of data) {
      const usd = item?.prices?.find((p) => p?.currency === 'usd')?.value
      if (usd && item?.address) {
        out.set(`${item.network}:${String(item.address).toLowerCase()}`, parseFloat(usd))
      }
    }
  }
  return out
}

async function getNativePricesUSD(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!ALCHEMY_KEY || symbols.length === 0) return out
  const unique = Array.from(new Set(symbols))
  const qs = unique.map((s) => `symbols=${encodeURIComponent(s)}`).join('&')
  try {
    const res = await withTimeout(
      fetch(`https://api.g.alchemy.com/prices/v1/${ALCHEMY_KEY}/tokens/by-symbol?${qs}`),
      6000
    )
    if (!res || !res.ok) return out
    const data = (await res.json()) as { data?: AlchemyPriceItem[] }
    for (const item of data?.data ?? []) {
      const usd = item?.prices?.find((p) => p?.currency === 'usd')?.value
      if (usd && item?.symbol) out.set(item.symbol, parseFloat(usd))
    }
  } catch {}
  return out
}

export interface ChainCostBreakdown {
  chain: string
  nativeSymbol: string
  nativeAmount: number
  usd: number
  txCount: number
  failedCount: number
}

export interface WalletCosts {
  address: string
  totalUsd: number
  totalTxCount: number
  totalFailedCount: number
  breakdown: ChainCostBreakdown[]
  truncated: boolean
}

async function getChainGasCost(
  address: string,
  chainName: string,
  chainId: number
): Promise<{ gasSpentNative: number; txCount: number; failedCount: number; truncated: boolean }> {
  if (!ETHERSCAN_KEY) return { gasSpentNative: 0, txCount: 0, failedCount: 0, truncated: false }
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=desc&apikey=${ETHERSCAN_KEY}`
    const res = await withTimeout(fetch(url), 10000)
    if (!res || !res.ok) return { gasSpentNative: 0, txCount: 0, failedCount: 0, truncated: false }
    const data = await res.json()
    if (!Array.isArray(data.result)) return { gasSpentNative: 0, txCount: 0, failedCount: 0, truncated: false }

    const truncated = data.result.length === 10000
    let totalWei = BigInt(0)
    let txCount = 0
    let failedCount = 0
    const lowerAddr = address.toLowerCase()
    for (const tx of data.result) {
      if (typeof tx?.from !== 'string' || tx.from.toLowerCase() !== lowerAddr) continue
      txCount++
      if (tx.isError === '1') failedCount++
      try {
        totalWei += BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0')
      } catch {}
    }
    return {
      gasSpentNative: parseFloat(formatEther(totalWei)),
      txCount,
      failedCount,
      truncated,
    }
  } catch {
    return { gasSpentNative: 0, txCount: 0, failedCount: 0, truncated: false }
  }
}

export async function getWalletCosts(address: string): Promise<WalletCosts> {
  const chainEntries = Object.entries(chains) as [string, (typeof chains)[keyof typeof chains]][]

  const costResults = await Promise.allSettled(
    chainEntries.map(async ([name, cfg]) => {
      const r = await getChainGasCost(address, name, cfg.chainId)
      return { name, ...r }
    })
  )

  const nativeSymbols = chainEntries
    .map(([name]) => nativeSymbolByChain[name])
    .filter((s): s is string => Boolean(s))
  const nativePrices = await getNativePricesUSD(nativeSymbols)

  const breakdown: ChainCostBreakdown[] = []
  let totalUsd = 0
  let totalTxCount = 0
  let totalFailedCount = 0
  let truncated = false

  for (const r of costResults) {
    if (r.status !== 'fulfilled') continue
    const v = r.value
    if (v.txCount === 0 && v.gasSpentNative === 0) continue
    const nativeSymbol = nativeSymbolByChain[v.name] || ''
    const price = nativeSymbol ? nativePrices.get(nativeSymbol) || 0 : 0
    const usd = v.gasSpentNative * price
    breakdown.push({
      chain: v.name,
      nativeSymbol,
      nativeAmount: v.gasSpentNative,
      usd,
      txCount: v.txCount,
      failedCount: v.failedCount,
    })
    totalUsd += usd
    totalTxCount += v.txCount
    totalFailedCount += v.failedCount
    if (v.truncated) truncated = true
  }

  return {
    address,
    totalUsd,
    totalTxCount,
    totalFailedCount,
    breakdown: breakdown.sort((a, b) => b.usd - a.usd),
    truncated,
  }
}

export interface WalletTxProfile {
  address: string
  counterparties: Set<string>
  firstFunder: string | null
  txCount: number
}

async function getWalletTxProfileEthereum(address: string): Promise<WalletTxProfile> {
  const empty: WalletTxProfile = { address, counterparties: new Set(), firstFunder: null, txCount: 0 }
  if (!ETHERSCAN_KEY) return empty
  try {
    // page 1 sort=asc to grab funder, then page 1 sort=desc for last 10k counterparties
    const lower = address.toLowerCase()
    const [firstRes, recentRes] = await Promise.all([
      withTimeout(
        fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_KEY}`
        ),
        6000
      ),
      withTimeout(
        fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=desc&apikey=${ETHERSCAN_KEY}`
        ),
        12000
      ),
    ])

    let firstFunder: string | null = null
    if (firstRes && firstRes.ok) {
      const data = await firstRes.json()
      const tx = Array.isArray(data.result) ? data.result[0] : null
      if (tx?.from && typeof tx.from === 'string' && tx.from.toLowerCase() !== lower) {
        firstFunder = tx.from.toLowerCase()
      }
    }

    const counterparties = new Set<string>()
    let txCount = 0
    if (recentRes && recentRes.ok) {
      const data = await recentRes.json()
      if (Array.isArray(data.result)) {
        for (const tx of data.result) {
          txCount++
          const from = typeof tx?.from === 'string' ? tx.from.toLowerCase() : ''
          const to = typeof tx?.to === 'string' ? tx.to.toLowerCase() : ''
          if (from && from !== lower) counterparties.add(from)
          if (to && to !== lower) counterparties.add(to)
        }
      }
    }

    return { address, counterparties, firstFunder, txCount }
  } catch {
    return empty
  }
}

export interface SybilPair {
  walletA: string
  walletB: string
  directTransfers: number
  commonCounterparties: string[]
  sharedFunder: string | null
  riskLevel: 'clean' | 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
}

export interface SybilReport {
  walletsAnalyzed: number
  pairs: SybilPair[]
  atRisk: number
  generatedAt: string
}

function classifySybilRisk(directTransfers: number, commonCount: number, sharedFunder: boolean): {
  level: SybilPair['riskLevel']
  score: number
} {
  let score = 0
  if (directTransfers > 0) score += 50 + Math.min(20, directTransfers * 5)
  if (sharedFunder) score += 30
  score += Math.min(40, commonCount * 2)

  let level: SybilPair['riskLevel']
  if (score >= 80) level = 'critical'
  else if (score >= 50) level = 'high'
  else if (score >= 25) level = 'medium'
  else if (score >= 10) level = 'low'
  else level = 'clean'

  return { level, score: Math.min(100, score) }
}

export async function analyzeSybilRisk(addresses: string[]): Promise<SybilReport> {
  const unique = Array.from(new Set(addresses.map((a) => a.toLowerCase())))
  if (unique.length < 2) {
    return { walletsAnalyzed: unique.length, pairs: [], atRisk: 0, generatedAt: new Date().toISOString() }
  }

  const profiles = await Promise.all(unique.map((a) => getWalletTxProfileEthereum(a)))

  const pairs: SybilPair[] = []
  let atRisk = 0

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i]
      const b = profiles[j]
      const aLower = a.address.toLowerCase()
      const bLower = b.address.toLowerCase()

      // Direct transfers between A and B
      let directTransfers = 0
      if (a.counterparties.has(bLower)) directTransfers++
      if (b.counterparties.has(aLower)) directTransfers++

      // Common counterparties (excluding each other)
      const common: string[] = []
      for (const c of a.counterparties) {
        if (c === aLower || c === bLower) continue
        if (b.counterparties.has(c)) common.push(c)
      }

      const sharedFunder =
        a.firstFunder !== null && b.firstFunder !== null && a.firstFunder === b.firstFunder
          ? a.firstFunder
          : null

      const { level, score } = classifySybilRisk(directTransfers, common.length, !!sharedFunder)
      if (level !== 'clean') atRisk++

      pairs.push({
        walletA: a.address,
        walletB: b.address,
        directTransfers,
        commonCounterparties: common.slice(0, 20),
        sharedFunder,
        riskLevel: level,
        riskScore: score,
      })
    }
  }

  return {
    walletsAnalyzed: unique.length,
    pairs: pairs.sort((a, b) => b.riskScore - a.riskScore),
    atRisk,
    generatedAt: new Date().toISOString(),
  }
}

async function getWalletAge(address: string): Promise<{ ageDays: number; firstTxDate: string | null }> {
  if (!ETHERSCAN_KEY) return { ageDays: 0, firstTxDate: null }
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_KEY}`
    const res = await withTimeout(fetch(url), 6000)
    if (!res || !res.ok) return { ageDays: 0, firstTxDate: null }
    const data = await res.json()
    const firstTx = Array.isArray(data.result) ? data.result[0] : null
    if (!firstTx?.timeStamp) return { ageDays: 0, firstTxDate: null }
    const firstMs = parseInt(firstTx.timeStamp) * 1000
    const ageDays = Math.floor((Date.now() - firstMs) / 86400000)
    return { ageDays: Math.max(0, ageDays), firstTxDate: new Date(firstMs).toISOString() }
  } catch {
    return { ageDays: 0, firstTxDate: null }
  }
}

async function analyzeChain(address: string, chainName: string): Promise<WalletActivity | null> {
  const [txCountRaw, nativeBalanceRaw] = await Promise.all([
    withTimeout(getTransactionCount(address, chainName), 6000),
    withTimeout(getWalletBalance(address, chainName), 6000),
  ])
  const txCount = txCountRaw || 0
  const nativeBalance = nativeBalanceRaw || '0'

  let tokens: TokenBalance[] = []
  if (txCount > 0 || parseFloat(nativeBalance) > 0) {
    tokens = (await withTimeout(getTokenBalances(address, chainName), 10000)) || []
  }

  if (txCount === 0 && parseFloat(nativeBalance) === 0 && tokens.length === 0) return null
  return { chain: chainName, txCount, nativeBalance, tokens }
}

export async function analyzeWallet(address: string): Promise<WalletAnalysis> {
  const chainNames = Object.keys(chains)

  const [chainResults, ageInfo] = await Promise.all([
    Promise.allSettled(chainNames.map((c) => analyzeChain(address, c))),
    getWalletAge(address),
  ])

  const activities: WalletActivity[] = []
  for (const r of chainResults) {
    if (r.status === 'fulfilled' && r.value) activities.push(r.value)
  }

  // USD pricing: ERC20 tokens by contract + native tokens by symbol, in parallel.
  const tokenLookups = activities.flatMap((a) => {
    const network = alchemyNetworkSlug[a.chain]
    if (!network) return []
    return a.tokens
      .filter((t) => t.contractAddress)
      .map((t) => ({ network, address: t.contractAddress! }))
  })
  const nativeSymbols = activities
    .map((a) => nativeSymbolByChain[a.chain])
    .filter((s): s is string => Boolean(s))

  const [tokenPrices, nativePrices] = await Promise.all([
    getTokenPricesUSD(tokenLookups),
    getNativePricesUSD(nativeSymbols),
  ])

  for (const a of activities) {
    let chainUsd = 0
    const network = alchemyNetworkSlug[a.chain]
    for (const t of a.tokens) {
      if (!t.contractAddress || !network) continue
      const price = tokenPrices.get(`${network}:${t.contractAddress.toLowerCase()}`)
      if (price && price > 0) {
        const value = parseFloat(t.balance) * price
        if (Number.isFinite(value) && value > 0) {
          t.usdValue = value
          chainUsd += value
        }
      }
    }
    const ns = nativeSymbolByChain[a.chain]
    const np = ns ? nativePrices.get(ns) : undefined
    if (np && np > 0) {
      const nUsd = parseFloat(a.nativeBalance) * np
      if (Number.isFinite(nUsd) && nUsd > 0) {
        a.nativeUsd = nUsd
        chainUsd += nUsd
      }
    }
    a.chainUsd = chainUsd
  }

  const totalTx = activities.reduce((sum, a) => sum + a.txCount, 0)
  const allTokens = activities.flatMap((a) => a.tokens)
  const totalUsdValue = activities.reduce((sum, a) => sum + (a.chainUsd ?? 0), 0)
  const ethereumActivity = activities.find((a) => a.chain === 'ethereum')
  const balance = ethereumActivity?.nativeBalance ?? '0'

  return {
    address,
    balance,
    chains: activities,
    totalTxCount: totalTx,
    walletAge: ageInfo.ageDays,
    firstTxDate: ageInfo.firstTxDate,
    riskScore: calculateRiskScore(activities, ageInfo.ageDays),
    recommendations: generateRecommendations(activities, ageInfo.ageDays),
    defiPositions: [],
    totalTokenValue: allTokens.length,
    totalUsdValue,
  }
}

function calculateRiskScore(activities: WalletActivity[], ageDays = 0): number {
  let score = 30

  if (activities.length >= 3) score += 10
  if (activities.length >= 5) score += 10

  const totalTx = activities.reduce((sum, a) => sum + a.txCount, 0)
  if (totalTx >= 20) score += 5
  if (totalTx >= 50) score += 10
  if (totalTx >= 100) score += 10

  const hasTokens = activities.some(a => a.tokens.length > 0)
  if (hasTokens) score += 5

  if (ageDays >= 180) score += 5
  if (ageDays >= 365) score += 5

  return Math.min(100, score)
}

function generateRecommendations(activities: WalletActivity[], ageDays = 0): string[] {
  const recs: string[] = []

  if (activities.length < 3) {
    recs.push('Активен в большем количестве сетей для повышения элиджиблити')
  }

  const totalTx = activities.reduce((sum, a) => sum + a.txCount, 0)
  if (totalTx < 20) {
    recs.push('Увеличьте количество транзакций (минимум 20)')
  } else if (totalTx < 50) {
    recs.push('Для лучшей элиджиблити нужно 50+ транзакций')
  }

  const hasArbitrum = activities.some(a => a.chain === 'arbitrum')
  if (!hasArbitrum) {
    recs.push('Добавьте активность в Arbitrum — высокий потенциал аирдропов')
  }

  const hasBase = activities.some(a => a.chain === 'base')
  if (!hasBase) {
    recs.push('Попробуйте Base — растущая экосистема с потенциальными аирдропами')
  }

  const hasTokens = activities.some(a => a.tokens.length > 0)
  if (!hasTokens) {
    recs.push('Держите ERC-20 токены — показывает серьёзность кошелька')
  }

  if (ageDays > 0 && ageDays < 90) {
    recs.push('Кошелёк молодой (<90 дн.) — снапшоты могут отсечь по возрасту')
  }

  return recs
}
