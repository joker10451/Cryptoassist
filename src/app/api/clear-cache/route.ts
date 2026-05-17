import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    message: 'Call this from browser console: localStorage.clear(); location.reload()',
    keys: Object.keys(typeof window !== 'undefined' ? localStorage : {}),
  })
}
