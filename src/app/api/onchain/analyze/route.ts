import { NextRequest, NextResponse } from 'next/server'
import { analyzeWallet } from '@/lib/onchain'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()

    if (!address) {
      return NextResponse.json({ error: 'Адрес кошелька не предоставлен' }, { status: 400 })
    }

    const analysis = await analyzeWallet(address)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('On-chain analysis error:', error)
    return NextResponse.json({ error: 'Ошибка анализа' }, { status: 500 })
  }
}
