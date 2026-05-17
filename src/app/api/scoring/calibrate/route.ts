import { NextRequest, NextResponse } from 'next/server'
import { calibrateWeights } from '@/lib/scoring/calibrator'
import { isInternalRequestAuthorized } from '@/lib/internalAuth'
import { sendTelegramAlert, formatCalibrationAlert } from '@/lib/telegram'

/**
 * POST /api/scoring/calibrate
 *   body: { dryRun?: boolean }
 *   GET  /api/scoring/calibrate — для Vercel Cron (всегда не-dry, без body).
 *
 *   Защита: x-internal-token ИЛИ Authorization: Bearer <CRON_SECRET>.
 *   В dev (ни одна не задана) — открыто.
 */
export async function POST(req: NextRequest) {
  if (!isInternalRequestAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let dryRun = false
  try {
    const body = await req.json().catch(() => ({}))
    dryRun = !!body?.dryRun
  } catch {
    /* empty body — ok */
  }

  const result = await calibrateWeights({ dryRun })
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  if (!isInternalRequestAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await calibrateWeights({ dryRun: false })
  void sendTelegramAlert({ text: formatCalibrationAlert(result.samples, result.applied), html: true })
  return NextResponse.json(result)
}
