import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('probability_score', { ascending: false })
      .limit(20)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Projects API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
