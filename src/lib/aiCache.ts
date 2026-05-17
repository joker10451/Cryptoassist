import { supabase } from './supabase'
import type { Json } from '@/types/database'

export type AnalysisType = 'parse_tasks' | 'score_project' | 'analyze_wallet' | 'wallet_costs'

/**
 * Стабильный хеш для произвольной строки. Используется как cache_key.
 * Не криптостойкий — нам нужно только устойчивое сопоставление input → key.
 */
export function hashKey(input: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

/**
 * Вернуть кешированный результат AI-анализа, если он не старше ttlMs.
 * Возвращает null, если запись не найдена / устарела / Supabase недоступен.
 */
export async function getCachedAnalysis<T = unknown>(
  type: AnalysisType,
  cacheKey: string,
  ttlMs: number
): Promise<T | null> {
  try {
    const cutoff = new Date(Date.now() - ttlMs).toISOString()
    const { data, error } = await supabase
      .from('ai_analyses')
      .select('output_data, created_at')
      .eq('analysis_type', type)
      .eq('input_data->>cache_key', cacheKey)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[aiCache] read error:', error.message)
      return null
    }
    return (data?.output_data as T) ?? null
  } catch (err) {
    console.error('[aiCache] read exception:', err)
    return null
  }
}

/**
 * Сохранить результат AI-анализа. Не блокирует выполнение route — ошибки только логируются.
 */
export async function saveCachedAnalysis(
  type: AnalysisType,
  cacheKey: string,
  input: Record<string, unknown>,
  output: unknown
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_analyses').insert({
      analysis_type: type,
      input_data: { ...input, cache_key: cacheKey } as unknown as Json,
      output_data: output as Json,
    })
    if (error) console.error('[aiCache] write error:', error.message)
  } catch (err) {
    console.error('[aiCache] write exception:', err)
  }
}

/**
 * Удалить записи старше cutoffMs. Можно вызывать из cron.
 */
export async function pruneCache(cutoffMs: number): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - cutoffMs).toISOString()
    const { error, count } = await supabase
      .from('ai_analyses')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)

    if (error) {
      console.error('[aiCache] prune error:', error.message)
      return 0
    }
    return count ?? 0
  } catch (err) {
    console.error('[aiCache] prune exception:', err)
    return 0
  }
}
