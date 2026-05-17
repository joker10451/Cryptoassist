import { NextRequest, NextResponse } from 'next/server'
import { getWallets, createWallet, deleteWallet, updateWallet } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'default'
    const wallets = await getWallets(userId)
    return NextResponse.json(wallets)
  } catch (error) {
    console.error('GET wallets error:', error)
    return NextResponse.json({ error: 'Ошибка получения кошельков' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId || 'default'
    
    if (!body.address) {
      return NextResponse.json({ error: 'Адрес обязателен' }, { status: 400 })
    }

    const wallet = await createWallet({
      address: body.address,
      label: body.label,
      tags: body.tags,
      chain: body.chain,
    }, userId)

    if (!wallet) {
      return NextResponse.json({ error: 'Ошибка создания кошелька' }, { status: 500 })
    }

    return NextResponse.json({ success: true, wallet })
  } catch (error) {
    console.error('POST wallets error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId') || 'default'

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const success = await deleteWallet(id, userId)

    if (!success) {
      return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE wallets error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const userId = body.userId || 'default'
    
    if (!body.id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const wallet = await updateWallet(body.id, {
      label: body.label,
      tags: body.tags,
      chain: body.chain,
    }, userId)

    if (!wallet) {
      return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
    }

    return NextResponse.json({ success: true, wallet })
  } catch (error) {
    console.error('PATCH wallets error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
