/**
 * Доступ к динамическому состоянию скоринга:
 *  - активный набор весов (scoring_weights, where active=true)
 *  - горячие нарративы (narrative_state, where hot=true)
 *
 * Если БД недоступна / таблицы пустые — фоллбек на DEFAULT_*.
 *
 * Кеш в памяти на 60 секунд: чтобы не дёргать Supabase на каждый scoreProject.
 */

import { supabase } from '@/lib/supabase'
import { DEFAULT_HOT_NARRATIVES, DEFAULT_WEIGHTS, type ScoringWeights } from './types'

const TTL_MS = 60_000

let weightsCache: { value: ScoringWeights; at: number } | null = null
let narrativesCache: { value: readonly string[]; at: number } | null = null

function fresh<T>(c: { value: T; at: number } | null): c is { value: T; at: number } {
  return !!c && Date.now() - c.at < TTL_MS
}

export async function getActiveWeights(): Promise<ScoringWeights> {
  if (fresh(weightsCache)) return weightsCache.value

  try {
    const { data, error } = await supabase
      .from('scoring_weights')
      .select('weights')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[scoring/state] weights read error:', error.message)
      weightsCache = { value: DEFAULT_WEIGHTS, at: Date.now() }
      return DEFAULT_WEIGHTS
    }

    const raw = data?.weights as Partial<ScoringWeights> | null | undefined
    const merged: ScoringWeights = { ...DEFAULT_WEIGHTS, ...(raw || {}) }
    weightsCache = { value: merged, at: Date.now() }
    return merged
  } catch (err) {
    console.warn('[scoring/state] weights exception:', err)
    return DEFAULT_WEIGHTS
  }
}

export async function getHotNarratives(): Promise<readonly string[]> {
  if (fresh(narrativesCache)) return narrativesCache.value

  try {
    const { data, error } = await supabase
      .from('narrative_state')
      .select('tag, hot')
      .eq('hot', true)

    if (error || !data || data.length === 0) {
      narrativesCache = { value: DEFAULT_HOT_NARRATIVES, at: Date.now() }
      return DEFAULT_HOT_NARRATIVES
    }

    const tags = data.map((r) => r.tag)
    narrativesCache = { value: tags, at: Date.now() }
    return tags
  } catch {
    return DEFAULT_HOT_NARRATIVES
  }
}

export function invalidateScoringCache(): void {
  weightsCache = null
  narrativesCache = null
}
