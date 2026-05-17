import { NextRequest, NextResponse } from 'next/server'
import { getWalletCosts } from '@/lib/onchain'
import { saveCachedAnalysis } from '@/lib/aiCache'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()

    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      return NextResponse.json({ error: 'Некорректный адрес кошелька' }, { status: 400 })
    }

    const costs = await getWalletCosts(address)
    void saveCachedAnalysis('wallet_costs', `costs-${address.toLowerCase()}`, { address }, costs)
    return NextResponse.json(costs)
  } catch (error) {
    console.error('Wallet costs error:', error)
    return NextResponse.json({ error: 'Ошибка расчёта расходов' }, { status: 500 })
  }
}
