import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { url, text } = await req.json()
    if (!url && !text) return NextResponse.json({ error: 'URL or text required' }, { status: 400 })

    const prompt = `Extract crypto project. Return ONLY JSON: {"name":"X","category":"layer1","ecosystem":"ethereum","funding":55000000,"investors":["Bain"],"tokenStatus":"no_token","probability":75,"summary":"Desc","website":"https://x.com","twitter":"https://twitter.com","discord":null}

Text: ${text || url}`

    const aiRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NVIDIA_API_KEY },
      body: JSON.stringify({ model: 'meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 512 }),
    })

    if (!aiRes.ok) return NextResponse.json({ error: 'AI failed: ' + aiRes.status }, { status: 500 })

    const aiData = await aiRes.json()
    const content = aiData.choices?.[0]?.message?.content || '{}'
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
    const m = clean.match(/\{[\s\S]*\}/)
    const pd = m ? JSON.parse(m[0]) : {}

    if (!pd.name) return NextResponse.json({ error: 'No name extracted' }, { status: 400 })

    return NextResponse.json({ success: true, project: pd })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
