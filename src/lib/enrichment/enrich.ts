/**
 * Оркестратор обогащения проекта из бесплатных публичных источников.
 *
 * Берёт slug/name/website, по очереди дёргает CoinGecko + DefiLlama,
 * аккуратно мержит, возвращает структуру для записи в public.projects.
 *
 * Ничего не пишет в БД сам — это работа /api/projects/enrich.
 */

import {
  findChain,
  findProtocol,
  findRaises,
  getProtocolDetail,
  aggregateRaises,
  type DefiLlamaProtocolLite,
  type DefiLlamaChain,
} from './defillama'
import {
  searchCoinGecko,
  getCoinGeckoData,
  type CoinGeckoData,
} from './coingecko'
import {
  pickBestRepoMomentum,
  type GitHubRepoMomentum,
} from './github'
import {
  getFundingRoundsBySlug,
  searchFundingRounds,
  aggregateFunding,
} from './dropstab'

export interface EnrichmentResult {
  /** Что нашли по источникам — для дебага и отображения. */
  sources: {
    coingecko: CoinGeckoData | null
    defillama: DefiLlamaProtocolLite | null
    defillama_chain: DefiLlamaChain | null
    raises_count: number
    github: GitHubRepoMomentum | null
  }
  patch: ProjectPatch
  scoring_inputs: ScoringSignals
  notes: string[]
}

export interface ProjectPatch {
  description?: string | null
  category?: string | null
  ecosystem?: string | null
  website_url?: string | null
  twitter_url?: string | null
  github_url?: string | null
  funding_amount?: number | null
  investors?: string[]
}

export interface ScoringSignals {
  funding_amount?: number
  investors?: string[]
  /** Категории CoinGecko часто содержат "Layer 2", "AI" и т.п. — отдадим в narratives. */
  narratives?: string[]
  /** Из GitHub /commits за 30 дней. Идёт в market_momentum. */
  github_commits_30d?: number
  /** Свежесть pushed_at (используем как proxy для signal_freshness). */
  last_signal_at?: string
}

interface EnrichInput {
  slug: string
  name: string
  /** Если уже есть, не перезатираем. */
  existing?: {
    description?: string | null
    category?: string | null
    ecosystem?: string | null
    website_url?: string | null
    twitter_url?: string | null
    github_url?: string | null
    funding_amount?: number | null
    investors?: string[] | null
  }
}

const TWITTER_URL = (handle: string) => `https://twitter.com/${handle.replace(/^@/, '')}`

function pickFirst<T>(...vals: (T | null | undefined)[]): T | null {
  for (const v of vals) if (v !== null && v !== undefined && v !== ('' as unknown as T)) return v
  return null
}

function mapCategoryFromCoinGecko(categories: string[]): string | null {
  const all = categories.map((c) => c.toLowerCase())
  if (all.some((c) => c.includes('layer 2') || c.includes('layer-2') || c.includes('rollup')))
    return 'layer2'
  if (all.some((c) => c.includes('layer 1') || c.includes('layer-1'))) return 'layer1'
  if (all.some((c) => c.includes('infrastructure') || c.includes('oracle') || c.includes('node')))
    return 'infra'
  if (all.some((c) => c.includes('decentralized finance') || c.includes('defi'))) return 'defi'
  if (all.some((c) => c.includes('gaming') || c.includes('gamefi') || c.includes('play-to-earn')))
    return 'gaming'
  if (all.some((c) => c.includes('nft'))) return 'nft'
  if (all.some((c) => c.includes('social'))) return 'social'
  return null
}

function mapCategoryFromDefiLlama(category: string | null | undefined): string | null {
  if (!category) return null
  const c = category.toLowerCase()
  if (c.includes('rollup') || c.includes('l2')) return 'layer2'
  if (c.includes('chain')) return 'layer1'
  if (c.includes('bridge') || c.includes('oracle')) return 'infra'
  if (c.includes('lending') || c.includes('dex') || c.includes('yield') || c.includes('cdp'))
    return 'defi'
  if (c.includes('nft') || c.includes('marketplace')) return 'nft'
  return 'defi' // DefiLlama по дефолту про DeFi
}

export async function enrichProject(input: EnrichInput): Promise<EnrichmentResult> {
  const notes: string[] = []
  const { slug, name, existing } = input

  // 1. DefiLlama chain — пробуем первым, потому что отдаёт gecko_id и tvl.
  //    Если найден chain, дальше CoinGecko детали можно получить без /search.
  let dlChain: DefiLlamaChain | null = null
  try {
    dlChain = (await findChain(name)) ?? (await findChain(slug))
    if (dlChain) {
      notes.push(
        `defillama-chain: matched name="${dlChain.name}", tvl=${dlChain.tvl ?? 'n/a'}, gecko_id=${dlChain.gecko_id ?? 'n/a'}`,
      )
    }
  } catch (err) {
    notes.push(`defillama-chain error: ${(err as Error).message}`)
  }

  // 2. CoinGecko: если у chain есть gecko_id, идём напрямую (1 запрос вместо 2).
  //    Иначе search → top hit → details.
  let cg: CoinGeckoData | null = null
  try {
    if (dlChain?.gecko_id) {
      cg = await getCoinGeckoData(dlChain.gecko_id)
      if (cg) notes.push(`coingecko: matched via gecko_id="${cg.id}"`)
      else notes.push(`coingecko: gecko_id="${dlChain.gecko_id}" detail failed`)
    }
    if (!cg) {
      let hits = await searchCoinGecko(name)
      if (hits.length === 0 && slug && slug !== name.toLowerCase()) {
        hits = await searchCoinGecko(slug)
      }
      if (hits.length === 0) {
        notes.push(`coingecko: no search hits for "${name}"`)
      } else {
        const sorted = hits.sort((a, b) => {
          const ar = a.market_cap_rank ?? 1e6
          const br = b.market_cap_rank ?? 1e6
          return ar - br
        })
        cg = await getCoinGeckoData(sorted[0].id)
        if (cg) notes.push(`coingecko: matched id="${cg.id}"`)
        else notes.push(`coingecko: detail fetch failed for id="${sorted[0].id}"`)
      }
    }
  } catch (err) {
    notes.push(`coingecko error: ${(err as Error).message}`)
  }

  // 3. DefiLlama protocol: только если это НЕ chain.
  let dl: DefiLlamaProtocolLite | null = null
  if (!dlChain) {
    try {
      const found = (await findProtocol(slug)) ?? (await findProtocol(name))
      if (found) {
        dl = await getProtocolDetail(found.slug)
        if (dl) notes.push(`defillama: matched slug="${dl.slug}", tvl=${dl.tvl ?? 'n/a'}`)
      } else {
        notes.push(`defillama: no protocol match`)
      }
    } catch (err) {
      notes.push(`defillama error: ${(err as Error).message}`)
    }
  }

  // 4. Funding: DropsTab (primary) → DefiLlama raises (fallback, paywalled).
  let raisesAgg = { total_usd: 0, investors: [] as string[], rounds: 0 }
  try {
    // DropsTab: пробуем точный slug проекта (использует наш slug или CoinGecko id),
    // потом fuzzy-search по имени.
    const candidateSlugs = [slug, cg?.id, name.toLowerCase().replace(/\s+/g, '-')].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )
    let dtRounds: Awaited<ReturnType<typeof getFundingRoundsBySlug>> = []
    for (const s of candidateSlugs) {
      dtRounds = await getFundingRoundsBySlug(s)
      if (dtRounds.length > 0) break
    }
    if (dtRounds.length === 0) {
      dtRounds = await searchFundingRounds(name)
    }

    if (dtRounds.length > 0) {
      const agg = aggregateFunding(dtRounds)
      raisesAgg = {
        total_usd: agg.total_usd,
        investors: agg.investors,
        rounds: dtRounds.length,
      }
      notes.push(
        `dropstab: ${dtRounds.length} rounds, $${(raisesAgg.total_usd / 1e6).toFixed(1)}M, ${raisesAgg.investors.length} investors${agg.top_tier_count > 0 ? `, ${agg.top_tier_count} tier-1` : ''}`,
      )
    } else {
      // Fallback: DefiLlama (paywalled)
      const raises = await findRaises(name, dl?.id)
      raisesAgg = aggregateRaises(raises)
      if (raisesAgg.rounds > 0) {
        notes.push(
          `defillama-raises: ${raisesAgg.rounds} rounds, $${(raisesAgg.total_usd / 1e6).toFixed(1)}M`,
        )
      } else {
        notes.push('funding: no data')
      }
    }
  } catch (err) {
    notes.push(`funding error: ${(err as Error).message}`)
  }

  // 5. GitHub: тянем repos из CoinGecko, выбираем самый активный, считаем momentum.
  let gh: GitHubRepoMomentum | null = null
  try {
    const ghUrls = (cg?.github_repos ?? []).filter(Boolean)
    if (ghUrls.length > 0) {
      gh = await pickBestRepoMomentum(ghUrls)
      if (gh) {
        notes.push(
          `github: ${gh.owner}/${gh.repo} commits_30d=${gh.commits_30d}, contributors=${gh.contributors ?? 'n/a'}, stars=${gh.stars ?? 'n/a'}`,
        )
      } else {
        notes.push(`github: ${ghUrls.length} URLs but momentum fetch failed`)
      }
    } else {
      notes.push('github: no repos in coingecko data')
    }
  } catch (err) {
    notes.push(`github error: ${(err as Error).message}`)
  }

  // --- Сборка patch для projects (не перезатираем уже заполненное) ---
  const patch: ProjectPatch = {}

  const description = pickFirst(
    existing?.description,
    cg?.description_en?.trim(),
    dl?.description?.trim(),
  )
  if (description && !existing?.description) patch.description = description.slice(0, 1500)

  const category =
    pickFirst(existing?.category) ??
    mapCategoryFromCoinGecko(cg?.categories ?? []) ??
    mapCategoryFromDefiLlama(dl?.category) ??
    (dlChain ? 'layer1' : null) // chain без категории — обычно L1/L2
  if (category && !existing?.category) patch.category = category

  // ecosystem: предпочитаем dl.chains, потом cg, потом наш собственный slug если это chain
  const ecosystem =
    pickFirst(
      existing?.ecosystem,
      dl?.chains?.[0],
      cg?.chains?.[0],
      dlChain ? dlChain.name.toLowerCase() : null,
    )?.toLowerCase() ?? null
  if (ecosystem && !existing?.ecosystem) patch.ecosystem = ecosystem

  const website = pickFirst(existing?.website_url, dl?.url, cg?.homepage)
  if (website && !existing?.website_url) patch.website_url = website

  const twitter = pickFirst(
    existing?.twitter_url,
    dl?.twitter ? TWITTER_URL(dl.twitter) : null,
  )
  if (twitter && !existing?.twitter_url) patch.twitter_url = twitter

  // Funding: только если нашли что-то осмысленное и existing пуст
  if (raisesAgg.total_usd > 0 && !existing?.funding_amount) {
    patch.funding_amount = raisesAgg.total_usd
  }
  const haveExistingInvestors = (existing?.investors?.length ?? 0) > 0
  if (raisesAgg.investors.length > 0 && !haveExistingInvestors) {
    patch.investors = raisesAgg.investors.slice(0, 50)
  }

  // GitHub URL — заполним если есть github и existing пуст
  if (gh && !existing?.github_url) {
    patch.github_url = `https://github.com/${gh.owner}/${gh.repo}`
  }

  // --- scoring_inputs (для немедленного вызова /api/ai/score-project) ---
  const scoring_inputs: ScoringSignals = {}
  if (raisesAgg.total_usd > 0) scoring_inputs.funding_amount = raisesAgg.total_usd
  if (raisesAgg.investors.length > 0) scoring_inputs.investors = raisesAgg.investors
  if ((cg?.categories?.length ?? 0) > 0) scoring_inputs.narratives = cg!.categories.slice(0, 6)
  if (gh) {
    scoring_inputs.github_commits_30d = gh.commits_30d
    if (gh.pushed_at) scoring_inputs.last_signal_at = gh.pushed_at
  }

  return {
    sources: {
      coingecko: cg,
      defillama: dl,
      defillama_chain: dlChain,
      raises_count: raisesAgg.rounds,
      github: gh,
    },
    patch,
    scoring_inputs,
    notes,
  }
}
