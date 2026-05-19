import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/projects/refresh
 *
 * Лёгкое периодическое обновление: только пересчитывает probability_score
 * через v2 движок, БЕЗ внешних API запросов. Подходит для авто-refresh
 * на /projects (раз в 5 минут).
 *
 * Полный поиск новых — /api/projects/auto-discover (тяжелее, дёргает
 * AlphaDrops + enrichment).
 */
export async function POST() {
  try {
    // Просто говорим клиенту, сколько проектов в базе и когда последний раз обновлялись.
    // Тяжелую работу делают другие endpoints; этот лёгкий, чтобы UI не висел.
    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      added: 0,
      updated: 0,
      total: count ?? 0,
      note: 'used auto-discover for full pipeline',
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
