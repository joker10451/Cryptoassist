import { NextRequest, NextResponse } from 'next/server'
import { analyzeSybilRisk } from '@/lib/onchain'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    let addresses: string[] = []

    try {
      const body = await req.json()
      if (Array.isArray(body?.addresses)) addresses = body.addresses
    } catch {
      // ignore — fallthrough to "use all wallets"
    }

    if (addresses.length === 0) {
      const { data } = await supabase.from('wallets').select('address')
      addresses = (data || []).map((w) => w.address)
    }

    if (addresses.length < 2) {
      return NextResponse.json({
        walletsAnalyzed: addresses.length,
        pairs: [],
        atRisk: 0,
        generatedAt: new Date().toISOString(),
        warning: 'Нужно минимум 2 кошелька для анализа',
      })
    }

    const report = await analyzeSybilRisk(addresses)
    return NextResponse.json(report)
  } catch (error) {
    console.error('Sybil analysis error:', error)
    return NextResponse.json({ error: 'Ошибка sybil-анализа' }, { status: 500 })
  }
}
