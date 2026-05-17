/**
 * v2 Scoring Engine — pure deterministic core.
 *
 * Никаких сетевых вызовов, никакого AI. AI кладётся поверх (см. score-project route)
 * для генерации narrative-сводки и red-flags, но цифры считаются здесь.
 *
 * Контракт: одинаковый input → одинаковый score. Это критично для
 * feedback loop: чтобы калибровать веса, нужно воспроизводимо считать.
 *
 * Renormalization: если компонент НЕ ПРИСУТСТВУЕТ (для него нет ни одного
 * входного сигнала), его вес перераспределяется пропорционально между
 * присутствующими позитивными компонентами. Это исключает штраф за
 * отсутствие данных. Risk считается отдельно как штраф.
 */

import {
  DEFAULT_HOT_NARRATIVES,
  DEFAULT_WEIGHTS,
  type Classification,
  type ScoringBreakdown,
  type ScoringInputs,
  type ScoringWeights,
} from './types'

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

interface ComponentResult {
  score: number
  /** false → нет входных данных, компонент исключается и его вес перераспределяется. */
  present: boolean
  reason?: string
}

// --- 1. Founding Quality -----------------------------------------------------

const TOP_TIER_VCS = new Set(
  [
    'a16z',
    'andreessen horowitz',
    'paradigm',
    'sequoia',
    'sequoia capital',
    'coinbase ventures',
    'multicoin',
    'multicoin capital',
    'polychain',
    'pantera',
    'binance labs',
    'jump',
    'jump crypto',
    'dragonfly',
    'electric capital',
    'framework ventures',
    'placeholder',
    'variant',
    'usv',
    'union square ventures',
  ].map((s) => s.toLowerCase()),
)

const SECOND_TIER_VCS = new Set(
  [
    'delphi',
    'delphi digital',
    'hashed',
    'animoca',
    'animoca brands',
    '1confirmation',
    'spartan',
    'spartan group',
    'ledgerprime',
    'maven 11',
    'maven11',
    'arrington capital',
    'arrington xrp',
    'standard crypto',
    'cumberland',
    'galaxy digital',
    'iosg',
    'shima capital',
    'lemniscap',
  ].map((s) => s.toLowerCase()),
)

function scoreFounding(i: ScoringInputs): ComponentResult {
  const investors = (i.investors || []).map((v) => v.toLowerCase().trim())
  const hasFunding = (i.funding_amount ?? 0) > 0
  const hasInvestors = investors.length > 0
  const hasTeam = i.team_known === true

  // Без сигналов вообще — компонент отсутствует.
  if (!hasFunding && !hasInvestors && !hasTeam) {
    return { score: 0, present: false }
  }

  const tier1 = investors.filter((v) => TOP_TIER_VCS.has(v)).length
  const tier2 = investors.filter((v) => SECOND_TIER_VCS.has(v)).length

  // VC tier — доминирующий фактор. 1 топовый VC = 60, 2+ = 80, 3+ = 95.
  let vcScore = 0
  if (tier1 >= 3) vcScore = 95
  else if (tier1 >= 2) vcScore = 80
  else if (tier1 >= 1) vcScore = 60
  else if (tier2 >= 2) vcScore = 50
  else if (tier2 >= 1) vcScore = 35
  else if (investors.length > 0) vcScore = 20

  // Сумма раунда. Логарифмическая шкала: $5M = 30, $50M = 65, $200M = 90.
  const fund = i.funding_amount ?? 0
  const fundScore = fund > 0 ? clamp(Math.log10(fund / 1e6 + 1) * 32, 0, 95) : 0

  const densityBonus = Math.min(15, Math.max(0, investors.length - 2) * 3)
  const teamBonus = i.team_known ? 8 : 0

  const final = clamp(Math.max(vcScore, fundScore) + densityBonus + teamBonus)

  let reason: string | undefined
  if (tier1 >= 1) reason = `${tier1} VC топ-уровня в раунде`
  else if (tier2 >= 1) reason = `${tier2} известных VC`
  else if (fund >= 5_000_000) reason = `Раунд $${(fund / 1e6).toFixed(1)}M`

  return { score: final, present: true, reason }
}

// --- 2. Airdrop Likelihood ---------------------------------------------------

function scoreAirdropLikelihood(i: ScoringInputs): ComponentResult {
  const hasAny =
    i.token_status !== undefined && i.token_status !== null
      ? true
      : i.has_points_program === true ||
        i.testnet_active === true ||
        i.retroactive_history === true
  if (!hasAny) return { score: 0, present: false }

  let score = 0
  const reasons: string[] = []

  if (i.token_status === 'no_token') {
    score += 30
    reasons.push('Токена ещё нет')
  } else if (i.token_status === 'rumored') {
    score += 20
    reasons.push('Слухи о токене')
  } else if (i.token_status === 'announced') {
    score += 25
    reasons.push('Токен анонсирован')
  } else if (i.token_status === 'launched') {
    score += 5 // ретродроп всё ещё возможен, но шанс ниже
  }

  if (i.has_points_program) {
    score += 25
    reasons.push('Есть points-программа')
  }
  if (i.testnet_active) {
    score += 20
    reasons.push('Активный тестнет')
  }
  if (i.retroactive_history) {
    score += 25
    reasons.push('Команда уже делала retroactive')
  }

  return {
    score: clamp(score),
    present: true,
    reason: reasons.length ? reasons.join(', ') : undefined,
  }
}

// --- 3. Farming Accessibility ------------------------------------------------

function scoreAccessibility(i: ScoringInputs): ComponentResult {
  const hasAny =
    typeof i.farming_cost_usd === 'number' ||
    typeof i.estimated_tx_count === 'number' ||
    i.requires_kyc !== undefined ||
    typeof i.task_count === 'number'
  if (!hasAny) return { score: 0, present: false }

  let score = 50 // нейтральный старт когда хотя бы один сигнал есть
  const reasons: string[] = []

  const cost = i.farming_cost_usd
  if (typeof cost === 'number') {
    if (cost <= 10) {
      score += 30
      reasons.push('Бесплатный/копеечный фарм')
    } else if (cost <= 100) {
      score += 15
    } else if (cost <= 500) {
      score += 0
    } else if (cost <= 1500) {
      score -= 15
    } else {
      score -= 25
      reasons.push('Дорогой вход')
    }
  }

  const txs = i.estimated_tx_count
  if (typeof txs === 'number') {
    if (txs <= 5) score += 10
    else if (txs <= 20) score += 0
    else if (txs <= 50) score -= 10
    else score -= 20
  }

  if (i.requires_kyc === true) {
    score -= 25
    reasons.push('Требуется KYC')
  } else if (i.requires_kyc === false) {
    score += 5
  }

  const tc = i.task_count
  if (typeof tc === 'number') {
    if (tc <= 3) score += 5
    else if (tc >= 15) score -= 10
  }

  return {
    score: clamp(score),
    present: true,
    reason: reasons.length ? reasons.join(', ') : undefined,
  }
}

// --- 4. Market Momentum ------------------------------------------------------

function scoreMomentum(i: ScoringInputs): ComponentResult {
  let score = 0
  let signals = 0
  const reasons: string[] = []

  const tg = i.twitter_growth_7d_pct
  if (typeof tg === 'number') {
    signals++
    if (tg >= 50) {
      score += 95
      reasons.push(`Twitter +${tg.toFixed(0)}% за неделю`)
    } else if (tg >= 20) score += 75
    else if (tg >= 5) score += 50
    else if (tg >= 0) score += 25
    else score += 5
  }

  const dm = i.discord_active_members
  if (typeof dm === 'number') {
    signals++
    if (dm >= 10000) score += 90
    else if (dm >= 3000) score += 70
    else if (dm >= 500) score += 45
    else if (dm >= 100) score += 25
    else score += 10
  }

  const gh = i.github_commits_30d
  if (typeof gh === 'number') {
    signals++
    if (gh >= 200) score += 90
    else if (gh >= 50) score += 65
    else if (gh >= 10) score += 35
    else score += 10
  }

  const tr = i.trending_rank
  if (typeof tr === 'number' && tr > 0) {
    signals++
    if (tr <= 5) score += 95
    else if (tr <= 20) score += 70
    else if (tr <= 50) score += 40
    else score += 15
  }

  if (signals === 0) return { score: 0, present: false }
  return {
    score: clamp(score / signals),
    present: true,
    reason: reasons.length ? reasons.join(', ') : undefined,
  }
}

// --- 5. Signal Freshness -----------------------------------------------------

function scoreFreshness(i: ScoringInputs): ComponentResult {
  if (!i.last_signal_at) return { score: 0, present: false }
  const t = Date.parse(i.last_signal_at)
  if (Number.isNaN(t)) return { score: 0, present: false }

  const ageHours = (Date.now() - t) / 36e5
  if (ageHours < 0)
    return { score: 100, present: true, reason: 'Сигнал из будущего? проверь часы' }
  if (ageHours <= 24) return { score: 100, present: true, reason: 'Сигнал свежий (<24ч)' }
  if (ageHours <= 72) return { score: 70, present: true, reason: 'Сигнал ≤3д' }
  if (ageHours <= 24 * 7) return { score: 40, present: true }
  if (ageHours <= 24 * 30) return { score: 15, present: true }
  return { score: 0, present: true, reason: 'Сигнал устарел (>30д)' }
}

// --- 6. Narrative Strength ---------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function scoreNarrative(
  i: ScoringInputs,
  hot: readonly string[],
): ComponentResult {
  const tags = (i.narratives || []).map(normalize).filter(Boolean)
  if (tags.length === 0) return { score: 0, present: false }

  const hotSet = new Set(hot.map(normalize))
  const matched = tags.filter((t) => {
    if (hotSet.has(t)) return true
    for (const h of hotSet) {
      if (t.includes(h) || h.includes(t)) return true
    }
    return false
  })

  if (matched.length === 0) return { score: 20, present: true }
  if (matched.length === 1)
    return { score: 70, present: true, reason: `Нарратив: ${matched[0]}` }
  return {
    score: 95,
    present: true,
    reason: `Несколько горячих нарративов: ${matched.join(', ')}`,
  }
}

// --- 7. Risk -----------------------------------------------------------------

function scoreRisk(i: ScoringInputs): ComponentResult {
  // Risk считаем всегда — отсутствие данных = 0 risk, это корректно.
  let risk = 0
  const reasons: string[] = []

  const scam = i.scam_signals ?? 0
  if (scam > 0) {
    risk += Math.min(60, scam * 20)
    reasons.push(`scam-сигналов: ${scam}`)
  }

  if (i.has_product === false) {
    risk += 30
    reasons.push('Нет продукта')
  }

  const dev = i.dev_activity_30d
  if (typeof dev === 'number' && dev < 5) {
    risk += 20
    reasons.push('Низкая dev-активность')
  }

  if (i.audit_status === 'unaudited') {
    risk += 10
  }

  return {
    score: clamp(risk),
    present: true,
    reason: reasons.length ? reasons.join(', ') : undefined,
  }
}

// --- Classification ----------------------------------------------------------

function classify(score: number): Classification {
  if (score >= 90) return 'LEGENDARY_ALPHA'
  if (score >= 75) return 'HIGH_PRIORITY'
  if (score >= 50) return 'MEDIUM'
  if (score >= 30) return 'LOW'
  return 'NOISE'
}

// --- Public API --------------------------------------------------------------

export interface ScoreOptions {
  weights?: Partial<ScoringWeights>
  hotNarratives?: readonly string[]
}

/**
 * Главная функция движка: посчитать v2 score по входным данным.
 * Чистая функция, безопасна для unit-тестов.
 *
 * Renormalization: пустые позитивные компоненты исключаются из суммы
 * и их вес перераспределяется между присутствующими пропорционально.
 * Risk применяется отдельно — если нет risk-сигналов, штрафа просто нет.
 */
export function scoreProject(input: ScoringInputs, opts: ScoreOptions = {}): ScoringBreakdown {
  const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, ...opts.weights }
  const hot = opts.hotNarratives ?? DEFAULT_HOT_NARRATIVES

  const founding = scoreFounding(input)
  const airdrop = scoreAirdropLikelihood(input)
  const access = scoreAccessibility(input)
  const momentum = scoreMomentum(input)
  const freshness = scoreFreshness(input)
  const narrative = scoreNarrative(input, hot)
  const risk = scoreRisk(input)

  const positive = [
    { name: 'Founding', key: 'founding_quality' as const, comp: founding },
    { name: 'Airdrop', key: 'airdrop_likelihood' as const, comp: airdrop },
    { name: 'Accessibility', key: 'farming_accessibility' as const, comp: access },
    { name: 'Momentum', key: 'market_momentum' as const, comp: momentum },
    { name: 'Freshness', key: 'signal_freshness' as const, comp: freshness },
    { name: 'Narrative', key: 'narrative_strength' as const, comp: narrative },
  ]

  const reasons: string[] = []
  const missing: string[] = []
  for (const { name, comp } of positive) {
    if (comp.reason) reasons.push(`${name}: ${comp.reason}`)
    if (!comp.present) missing.push(name)
  }
  if (risk.reason) reasons.push(`Risk: ${risk.reason}`)

  // Renormalization: суммарный вес присутствующих позитивных компонентов
  // должен в идеале равняться сумме всех позитивных весов из DEFAULT.
  const presentWeightSum = positive.reduce(
    (s, { key, comp }) => s + (comp.present ? weights[key] : 0),
    0,
  )
  const totalPositiveWeight = positive.reduce((s, { key }) => s + weights[key], 0)
  // Если ни одного компонента не нашлось (теоретически невозможно для реального
  // проекта — хотя бы Risk есть всегда), ставим scale=1 чтобы не делить на 0.
  const scale = presentWeightSum > 0 ? totalPositiveWeight / presentWeightSum : 1

  const positiveSum = positive.reduce(
    (s, { key, comp }) => s + (comp.present ? comp.score * weights[key] * scale : 0),
    0,
  )

  const final_score = clamp(positiveSum - risk.score * weights.risk)

  return {
    founding_quality: Math.round(founding.score),
    airdrop_likelihood: Math.round(airdrop.score),
    farming_accessibility: Math.round(access.score),
    market_momentum: Math.round(momentum.score),
    signal_freshness: Math.round(freshness.score),
    narrative_strength: Math.round(narrative.score),
    risk: Math.round(risk.score),
    weights,
    final_score: Math.round(final_score),
    classification: classify(final_score),
    reasons,
    missing_signals: missing,
  }
}

/**
 * Минимальный фильтр шума ДО вызова AI. Возвращает true, если контент
 * заслуживает дальнейшего анализа. Используется для tweet-фильтрации,
 * чтобы не жечь токены на «gm friends».
 */
export function isCryptoSignalRelevant(text: string): boolean {
  if (!text || text.length < 8) return false
  const t = text.toLowerCase()
  const KEYWORDS = [
    'airdrop',
    'testnet',
    'points',
    'retroactive',
    'snapshot',
    'farming',
    'incentives',
    'mainnet',
    'tge',
    'eligibility',
    'eligible',
    'quest',
    'galxe',
    'layer3',
    'zealy',
    'whitelist',
    'allowlist',
  ]
  return KEYWORDS.some((k) => t.includes(k))
}
