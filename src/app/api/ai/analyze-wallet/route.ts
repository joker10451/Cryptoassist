import { NextRequest, NextResponse } from 'next/server'
import { getCachedAnalysis, saveCachedAnalysis, hashKey } from '@/lib/aiCache'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const CACHE_TTL = 10 * 60 * 1000

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const { address, activity } = await req.json()

    if (!address) {
      return NextResponse.json({ error: 'Адрес кошелька не предоставлен' }, { status: 400 })
    }

    const cacheKey = `wallet-${hashKey(`${address}::${activity || ''}`)}`
    const cached = await getCachedAnalysis('analyze_wallet', cacheKey, CACHE_TTL)
    if (cached) {
      return NextResponse.json(cached)
    }

    const prompt = `Проанализируй крипто-кошелёк. Ответь ТОЛЬКО JSON:
{"strengths":[],"weaknesses":[],"recommendations":[{"action":"","impact":""}],"eligibleProjects":[{"name":"","score":1-100}],"summary":"резюме на русском"}`

    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: `${prompt}\n\nАдрес: ${address}\nАктивность: ${activity || 'Нет данных'}` }],
        temperature: 0.3,
        max_tokens: 512,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка AI сервиса' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    let parsed
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch {
      parsed = { strengths: [], weaknesses: [], recommendations: [], eligibleProjects: [], summary: 'Недостаточно данных' }
    }

    void saveCachedAnalysis('analyze_wallet', cacheKey, { address }, parsed)
    return NextResponse.json(parsed)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'AI сервис не отвечает (таймаут)' }, { status: 504 })
    }
    console.error('Analyze wallet error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
