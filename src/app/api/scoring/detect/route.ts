import { NextRequest, NextResponse } from 'next/server'
import { runDetector } from '@/lib/scoring/detector'
import { isInternalRequestAuthorized } from '@/lib/internalAuth'
import { sendTelegramAlert, formatDetectedAlert } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/scoring/detect
 *   body: { limit?: number, batchSize?: number, sinceHours?: number }
 * GET  /api/scoring/detect?sinceHours=3 — для Vercel Cron.
 *
 * Защита: x-internal-token ИЛИ Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: NextRequest) {
  if (!isInternalRequestAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const limit = typeof body?.limit === 'number' ? body.limit : undefined
  const batchSize = typeof body?.batchSize === 'number' ? body.batchSize : undefined
  const sinceMs =
    typeof body?.sinceHours === 'number' ? body.sinceHours * 3600 * 1000 : undefined

  const result = await runDetector({ limit, batchSize, sinceMs })
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  if (!isInternalRequestAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const sinceHoursRaw = url.searchParams.get('sinceHours')
  const sinceMs = sinceHoursRaw ? Number(sinceHoursRaw) * 3600 * 1000 : 3 * 3600 * 1000

  const result = await runDetector({ sinceMs })

  // Telegram alert: если появились новые кандидаты с confidence ≥ 80
  if (result.detected_upserted > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('detected_opportunities')
        .select('project_name, project_slug, confidence')
        .eq('status', 'pending')
        .gte('confidence', 80)
        .order('confidence', { ascending: false })
        .limit(5)
      if (data && data.length > 0) {
        const projects = (data as { project_name: string; project_slug: string; confidence: number }[]).map((d) => ({
          name: d.project_name,
          confidence: d.confidence,
          slug: d.project_slug,
        }))
        void sendTelegramAlert({ text: formatDetectedAlert(projects), html: true })
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json(result)
}
