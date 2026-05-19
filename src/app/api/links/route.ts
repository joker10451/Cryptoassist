import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/links
 *
 * Публичный endpoint для linktree-страницы /links.
 * Отдаёт ТОЛЬКО проекты с заполненной referral_url, минимум полей,
 * сортировка по probability_score DESC.
 *
 * НЕ светим тут internal данные (funding, investors, etc).
 */
export async function GET() {
  const { data, error } = await supabase
    .from('projects')
    .select('name, slug, category, description, referral_url, referral_notes, probability_score')
    .not('referral_url', 'is', null)
    .order('probability_score', { ascending: false, nullsFirst: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Доп. фильтрация на пустые строки (referral_url IS NOT NULL не поймает '')
  const filtered = (data ?? []).filter((p) => p.referral_url && p.referral_url.trim().length > 0)

  return NextResponse.json({
    projects: filtered.map((p) => ({
      name: p.name,
      slug: p.slug,
      category: p.category,
      description: p.description,
      referral_url: p.referral_url,
      referral_notes: p.referral_notes,
    })),
  })
}
