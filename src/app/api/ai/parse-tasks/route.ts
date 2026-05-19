import { NextRequest, NextResponse } from 'next/server'
import { getCachedAnalysis, saveCachedAnalysis, hashKey } from '@/lib/aiCache'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const CACHE_TTL = 5 * 60 * 1000

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

interface RawParsedTask {
  title?: unknown
  type?: unknown
  description?: unknown
  deadline?: unknown
  difficulty?: unknown
}

interface RawParsed {
  project?: unknown
  tasks?: unknown
  estimatedTime?: unknown
  estimatedCost?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Текст не предоставлен' }, { status: 400 })
    }

    const cacheKey = `parse-${hashKey(text)}`
    const cached = await getCachedAnalysis('parse_tasks', cacheKey, CACHE_TTL)
    if (cached) {
      return NextResponse.json(cached)
    }

    const prompt = `You extract crypto farming tasks from text. Return ONLY JSON.

Input: "${text}"

Output format:
{"project":"name","tasks":[{"title":"action","type":"bridge|swap|stake|mint|discord|social|testnet","description":"desc","deadline":null,"difficulty":3}],"estimatedTime":30,"estimatedCost":0}

Extract every action: bridges, swaps, stakes, discords, twitters, quests, testnets.
Return ONLY JSON.`

    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Return ONLY JSON. No explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка AI сервиса' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    let parsed: RawParsed
    try {
      const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(clean)
    } catch {
      parsed = { project: 'Неизвестно', tasks: [], estimatedTime: 30, estimatedCost: 0 }
    }

    const rawTasks: RawParsedTask[] = Array.isArray(parsed.tasks) ? parsed.tasks : []
    const result = {
      project: typeof parsed.project === 'string' ? parsed.project : 'Неизвестно',
      tasks: rawTasks.map((t) => ({
        title: typeof t.title === 'string' ? t.title : 'Задача',
        type: typeof t.type === 'string' ? t.type : 'custom',
        description: typeof t.description === 'string' ? t.description : '',
        deadline: typeof t.deadline === 'string' ? t.deadline : null,
        difficulty: Math.min(5, Math.max(1, Number(t.difficulty) || 3)),
      })),
      estimatedTime: typeof parsed.estimatedTime === 'number' ? parsed.estimatedTime : 30,
      estimatedCost: typeof parsed.estimatedCost === 'number' ? parsed.estimatedCost : 0,
    }

    void saveCachedAnalysis('parse_tasks', cacheKey, { text_preview: text.slice(0, 200) }, result)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const e = error as { name?: string }
    if (e.name === 'AbortError') {
      return NextResponse.json({ error: 'Таймаут AI' }, { status: 504 })
    }
    console.error('Parse error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
