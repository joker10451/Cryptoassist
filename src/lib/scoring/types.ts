/**
 * v2 Scoring Engine — types
 *
 * Чистые типы, без зависимостей от Supabase/Next.
 * Всё, что нужно знать движку, чтобы посчитать score.
 */

export type TokenStatus = 'no_token' | 'rumored' | 'announced' | 'launched'
export type AuditStatus = 'audited' | 'unaudited' | 'pending'
export type Classification = 'LEGENDARY_ALPHA' | 'HIGH_PRIORITY' | 'MEDIUM' | 'LOW' | 'NOISE'

/**
 * Вход для скоринга. Все поля опциональны — отсутствующий сигнал
 * трактуется как 0 (а не как «плохо»). Это важно: если у нас нет данных
 * о momentum, мы не штрафуем проект, а отмечаем component=0 в breakdown.
 */
export interface ScoringInputs {
  // 1. Founding Quality
  funding_amount?: number | null
  investors?: string[] | null
  team_known?: boolean | null

  // 2. Airdrop Likelihood
  token_status?: TokenStatus | null
  has_points_program?: boolean | null
  testnet_active?: boolean | null
  retroactive_history?: boolean | null

  // 3. Farming Accessibility
  farming_cost_usd?: number | null
  task_count?: number | null
  requires_kyc?: boolean | null
  estimated_tx_count?: number | null

  // 4. Market Momentum
  twitter_growth_7d_pct?: number | null
  discord_active_members?: number | null
  github_commits_30d?: number | null
  trending_rank?: number | null // 1 = на вершине, 100 = внизу

  // 5. Signal Freshness
  last_signal_at?: string | null // ISO timestamp последнего значимого сигнала

  // 6. Narrative Strength
  narratives?: string[] | null // например ["L2 season", "Restaking", "AI", "Modular"]

  // 7. Risk
  scam_signals?: number | null
  has_product?: boolean | null
  dev_activity_30d?: number | null
  audit_status?: AuditStatus | null
}

/**
 * Веса формулы. Сумма положительных = 0.95, риск с весом 0.15 вычитается.
 * Theoretical max = 95, min = -15.
 */
export interface ScoringWeights {
  founding_quality: number
  airdrop_likelihood: number
  farming_accessibility: number
  market_momentum: number
  signal_freshness: number
  narrative_strength: number
  risk: number // вычитается
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  founding_quality: 0.2,
  airdrop_likelihood: 0.25,
  farming_accessibility: 0.15,
  market_momentum: 0.15,
  signal_freshness: 0.1,
  narrative_strength: 0.1,
  risk: 0.15,
}

/**
 * Текущий список «горячих» нарративов. Хранится в Supabase (table: narrative_state),
 * но фоллбек сюда — чтобы движок работал и без БД.
 */
export const DEFAULT_HOT_NARRATIVES = [
  'l2',
  'l2 season',
  'restaking',
  'restake',
  'ai crypto',
  'ai agents',
  'modular',
  'modular blockchain',
  'da layer',
  'parallel evm',
  'bitcoin l2',
  'btc l2',
  'liquid staking',
  'rwa',
  'depin',
] as const

export interface ScoringBreakdown {
  founding_quality: number
  airdrop_likelihood: number
  farming_accessibility: number
  market_momentum: number
  signal_freshness: number
  narrative_strength: number
  risk: number

  /** Веса, использованные при расчёте (для аудита и UI). */
  weights: ScoringWeights

  /** Финальный score: clamp(sum(component * weight) - risk * w_risk, 0, 100). */
  final_score: number

  classification: Classification

  /** Человекочитаемые объяснения, что подняло/опустило score. */
  reasons: string[]

  /** Список компонентов, для которых вообще не было входных данных. */
  missing_signals: string[]
}
