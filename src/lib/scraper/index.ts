// Free API sources for discovering new crypto projects

// DefiLlama API — новые протоколы
export async function fetchDefiLlamaProtocols() {
  try {
    const res = await fetch('https://api.llama.fi/protocols')
    if (!res.ok) return []
    const data = await res.json()
    
    // Фильтруем по TVL < 10M (новые/маленькие проекты)
    return data
      .filter((p: any) => p.tvl < 10000000 && p.tvl > 0)
      .slice(0, 20)
      .map((p: any) => ({
        name: p.name,
        slug: p.slug,
        description: p.description || '',
        category: p.category?.toLowerCase() || 'defi',
        tvl: p.tvl,
        chain: p.chains?.[0] || 'multi-chain',
        website: p.url,
        twitter: p.twitter ? `https://twitter.com/${p.twitter}` : null,
        source: 'defillama',
      }))
  } catch {
    return []
  }
}

// L2Beat — новые L2 проекты
export async function fetchL2BeatProjects() {
  try {
    const res = await fetch('https://l2beat.com/api/scaling/summary')
    if (!res.ok) return []
    const data = await res.json()
    
    return data.projects
      .filter((p: any) => p.stage === 'Under review' || p.stage === 'Not enough data')
      .slice(0, 10)
      .map((p: any) => ({
        name: p.name,
        slug: p.slug,
        description: p.description?.short || '',
        category: 'layer2',
        stage: p.stage,
        website: p.links?.websiteUrl || null,
        twitter: p.links?.twitterUrl || null,
        source: 'l2beat',
      }))
  } catch {
    return []
  }
}

// RSS из CoinMarketCap (через RSS2JSON бесплатный API)
export async function fetchCryptoNews() {
  try {
    const rssUrl = encodeURIComponent('https://blog.coinbase.com/feed')
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=10`)
    if (!res.ok) return []
    const data = await res.json()
    
    return data.items
      .filter((item: any) => 
        item.title.toLowerCase().includes('airdrop') ||
        item.title.toLowerCase().includes('testnet') ||
        item.title.toLowerCase().includes('new') ||
        item.description.toLowerCase().includes('airdrop')
      )
      .slice(0, 5)
      .map((item: any) => ({
        title: item.title,
        description: item.description?.substring(0, 200) || '',
        url: item.link,
        date: item.pubDate,
        source: 'coinbase-blog',
      }))
  } catch {
    return []
  }
}

// CoinGecko — новые листинги (бесплатный API)
export async function fetchNewCoins() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/list')
    if (!res.ok) return []
    const data = await res.json()
    
    // Берем последние 50 (API не сортирует, но это база)
    return data.slice(-50).map((coin: any) => ({
      name: coin.name || coin.id,
      slug: coin.id,
      source: 'coingecko',
    }))
  } catch {
    return []
  }
}

// Агрегатор всех источников
export async function discoverProjects() {
  const [defillama, l2beat, news] = await Promise.all([
    fetchDefiLlamaProtocols(),
    fetchL2BeatProjects(),
    fetchCryptoNews(),
  ])

  return {
    protocols: defillama,
    l2s: l2beat,
    news,
    total: defillama.length + l2beat.length + news.length,
    timestamp: new Date().toISOString(),
  }
}
