import { NextRequest, NextResponse } from 'next/server'
import { analyzeWallet } from '@/lib/onchain'
import { checkAllEligibility, checkEligibility, getAvailableRuleSets } from '@/lib/eligibility'

/**
 * POST /api/wallets/eligibility
 *   body: { address: string, projectSlug?: string }
 *
 *   Если projectSlug указан — проверяет eligibility для одного проекта.
 *   Если нет — проверяет для всех проектов с правилами.
 *
 *   Тяжёлый endpoint: тянет on-chain данные по 6 сетям. ~5-15 секунд.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const address = typeof body?.address === 'string' ? body.address.trim() : ''
    const projectSlug = typeof body?.projectSlug === 'string' ? body.projectSlug : undefined

    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json({ error: 'Невалидный EVM адрес' }, { status: 400 })
    }

    // Тянем on-chain данные
    const wallet = await analyzeWallet(address)

    if (projectSlug) {
      const result = checkEligibility(wallet, projectSlug)
      return NextResponse.json({
        address,
        wallet_summary: {
          totalTxCount: wallet.totalTxCount,
          walletAge: wallet.walletAge,
          chainsActive: wallet.chains.filter((c) => c.txCount > 0).length,
          totalUsdValue: Math.round(wallet.totalUsdValue),
        },
        eligibility: result,
      })
    }

    const results = checkAllEligibility(wallet)
    return NextResponse.json({
      address,
      wallet_summary: {
        totalTxCount: wallet.totalTxCount,
        walletAge: wallet.walletAge,
        chainsActive: wallet.chains.filter((c) => c.txCount > 0).length,
        totalUsdValue: Math.round(wallet.totalUsdValue),
      },
      eligibility: results,
      available_projects: getAvailableRuleSets(),
    })
  } catch (err) {
    console.error('[wallets/eligibility]', err)
    return NextResponse.json({ error: 'Ошибка анализа' }, { status: 500 })
  }
}
