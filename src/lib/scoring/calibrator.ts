/**
 * Feedback-loop калибратор весов.
 *
 * Идея простая и честная: смотрим resolved outcomes (где известно,
 * был ли реально аирдроп), считаем для каждого component корреляцию
 * между его значением в момент скоринга и реальным исходом.
 *
 * Чем выше корреляция — тем больше вес. Используем point-biserial
 * (Pearson по бинарной y), это эквивалентно корреляции компонента с
 * фактом аирдропа на нашей выборке.
 *
 * Это НЕ ML. Это калибровка. Веса всегда нормируются, чтобы их сумма
 * совпадала с DEFAULT_WEIGHTS — мы только перераспределяем массу,
 * а не раздуваем диапазон score.
 */

import { supabase } from '@/lib/supabase'
import { DEFAULT_WEIGHTS, type ScoringBreakdown, type ScoringWeights } from './types'
import { invalidateScoringCache } from './state'

const COMPONENTS: (keyof ScoringWeights)[] = [
  'founding_quality',
  'airdrop_likelihood',
  'farming_accessibility',
  'market_momentum',
  'signal_freshness',
  'narrative_strength',
  'risk',
]

const MIN_SAMPLES = 8 // меньше — статистике не доверяем
const SMOOTHING = 0.4 // 0 = резко, 1 = вообще не двигать веса

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  let sx = 0,
    sy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
  }
  const mx = sx / n
  const my = sy / n

  let num = 0,
    dx2 = 0,
    dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom > 0 ? num / denom : 0
}

interface OutcomeRow {
  airdrop_happened: boolean | null
  real_outcome_value_usd: number | null
  breakdown: ScoringBreakdown | null
}

export interface CalibrationResult {
  samples: number
  correlations: Record<keyof ScoringWeights, number>
  newWeights: ScoringWeights
  applied: boolean
  reason?: string
}

export async function calibrateWeights(opts: { dryRun?: boolean } = {}): Promise<CalibrationResult> {
  const { dryRun = false } = opts

  // Берём только resolved outcomes
  const { data, error } = await supabase
    .from('scoring_outcomes')
    .select('airdrop_happened, real_outcome_value_usd, breakdown')
    .not('resolved_at', 'is', null)
    .limit(1000)

  if (error) {
    return {
      samples: 0,
      correlations: zeroCorr(),
      newWeights: DEFAULT_WEIGHTS,
      applied: false,
      reason: `read error: ${error.message}`,
    }
  }

  const rows: OutcomeRow[] = (data as OutcomeRow[]) || []
  if (rows.length < MIN_SAMPLES) {
    return {
      samples: rows.length,
      correlations: zeroCorr(),
      newWeights: DEFAULT_WEIGHTS,
      applied: false,
      reason: `not enough samples (${rows.length} < ${MIN_SAMPLES})`,
    }
  }

  // y = was airdrop. Если есть real_outcome_value, используем log10(value+1) как continuous,
  // иначе бинарное 0/1.
  const ys: number[] = rows.map((r) => {
    if (typeof r.real_outcome_value_usd === 'number' && r.real_outcome_value_usd > 0) {
      return Math.log10(r.real_outcome_value_usd + 1)
    }
    return r.airdrop_happened ? 1 : 0
  })

  const correlations: Record<keyof ScoringWeights, number> = {} as never

  for (const comp of COMPONENTS) {
    const xs: number[] = []
    const filteredYs: number[] = []
    for (let i = 0; i < rows.length; i++) {
      const v = (rows[i].breakdown as unknown as Record<string, number> | null)?.[comp]
      if (typeof v === 'number') {
        xs.push(v)
        filteredYs.push(ys[i])
      }
    }
    correlations[comp] = pearson(xs, filteredYs)
  }

  // Преобразуем корреляции в положительные веса.
  // Risk у нас инверсный — чем выше score, тем ХУЖЕ. Поэтому модуль |r|.
  // Но если корреляция «не та сторона» (например airdrop_likelihood вдруг отриц.),
  // веса не двигаем для этого компонента.
  const rawWeights: Record<keyof ScoringWeights, number> = {} as never
  for (const comp of COMPONENTS) {
    const r = correlations[comp]
    if (comp === 'risk') {
      // risk должен иметь отрицательную корреляцию с airdrop value.
      // Если она такая — увеличиваем |r|, иначе оставляем default.
      rawWeights[comp] = r < 0 ? Math.abs(r) : DEFAULT_WEIGHTS.risk
    } else {
      rawWeights[comp] = r > 0 ? r : DEFAULT_WEIGHTS[comp]
    }
  }

  // Нормируем так, чтобы сумма позитивных весов осталась как в DEFAULT.
  const positiveKeys = COMPONENTS.filter((c) => c !== 'risk')
  const sumPositiveDefault = positiveKeys.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0)
  const sumPositiveRaw = positiveKeys.reduce((s, k) => s + rawWeights[k], 0) || 1
  const normalized: ScoringWeights = { ...DEFAULT_WEIGHTS }
  for (const k of positiveKeys) {
    const target = (rawWeights[k] / sumPositiveRaw) * sumPositiveDefault
    // Сглаживание: новый = old * SMOOTHING + target * (1-SMOOTHING)
    normalized[k] = +(DEFAULT_WEIGHTS[k] * SMOOTHING + target * (1 - SMOOTHING)).toFixed(4)
  }
  // risk обновляем независимо, тоже со сглаживанием
  normalized.risk = +(
    DEFAULT_WEIGHTS.risk * SMOOTHING +
    Math.min(0.4, rawWeights.risk) * (1 - SMOOTHING)
  ).toFixed(4)

  if (dryRun) {
    return { samples: rows.length, correlations, newWeights: normalized, applied: false }
  }

  // Сохраняем как новый активный набор: сначала снимаем старый active,
  // потом ставим новый. Не атомарно, но допустимо для калибровки.
  await supabase.from('scoring_weights').update({ active: false }).eq('active', true)
  const { error: insErr } = await supabase.from('scoring_weights').insert({
    weights: normalized as unknown as import('@/types/database').Json,
    active: true,
    notes: `auto-calibrated from ${rows.length} outcomes`,
    calibrated_from: rows.length,
  })

  if (insErr) {
    return {
      samples: rows.length,
      correlations,
      newWeights: normalized,
      applied: false,
      reason: `insert error: ${insErr.message}`,
    }
  }

  invalidateScoringCache()
  return { samples: rows.length, correlations, newWeights: normalized, applied: true }
}

function zeroCorr(): Record<keyof ScoringWeights, number> {
  const r = {} as Record<keyof ScoringWeights, number>
  for (const c of COMPONENTS) r[c] = 0
  return r
}
