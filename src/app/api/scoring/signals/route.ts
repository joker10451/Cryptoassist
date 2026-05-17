import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isCryptoSignalRelevant } from '@/lib/scoring/engine'
import { isInternalRequestAuthorized } from '@/lib/internalAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface IncomingSignal {
  source: 'twitter' | 'discord' | 'rss' | 'manual'
  external_id?: string
  author?: string
  content: string
  url?: string
  matched_projects?: string[]
}

/**
 * POST /api/scoring/signals
 *   body: { signals: IncomingSignal[] }
 *
 *   Приёмник для внешнего скрейпера и manual entry на /scoring.
 *   Делает дешёвый keyword-фильтр ДО сохранения, чтобы 80% мусора
 *   даже не попадало в БД.
 *
 *   Авторизация:
 *    - x-internal-token ИЛИ Authorization: Bearer <CRON_SECRET> — для скрейпера/cron
 *    - Same-origin POST (origin == host) — для manual entry из UI без секретов.
 */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!isInternalRequestAuthorized(req) && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { signals?: IncomingSignal[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const incoming = Array.isArray(body?.signals) ? body.signals : []
  if (incoming.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 })
  }

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

  const filtered = incoming
    .filter((s) => s && typeof s.content === 'string' && isCryptoSignalRelevant(s.content))
    .map((s) => {
      const content = s.content.slice(0, 4000)
      const lc = content.toLowerCase()
      const matched_keywords = KEYWORDS.filter((k) => lc.includes(k))
      return {
        source: s.source,
        external_id: s.external_id ?? null,
        author: s.author ?? null,
        content,
        url: s.url ?? null,
        matched_keywords,
        matched_projects: Array.isArray(s.matched_projects) ? s.matched_projects : [],
        importance: Math.min(10, 3 + matched_keywords.length),
      }
    })

  if (filtered.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: incoming.length })
  }

  const { data, error } = await db
    .from('raw_signals')
    .upsert(filtered, { onConflict: 'source,external_id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('[signals POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped: incoming.length - filtered.length,
  })
}
