import { NextRequest, NextResponse } from 'next/server'
import { getCachedAnalysis, saveCachedAnalysis, hashKey } from '@/lib/aiCache'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const CACHE_TTL = 10 * 60 * 1000

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 25000) {
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

const VALID_TASK_TYPES = ['bridge', 'swap', 'stake', 'mint', 'discord', 'social', 'testnet', 'quest', 'custom']
const VALID_CATEGORIES = ['layer1', 'layer2', 'defi', 'infra', 'social', 'gaming', 'nft', 'other']

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

interface RawTask {
  title?: unknown
  task_type?: unknown
  description?: unknown
  difficulty?: unknown
  deadline?: unknown
}

interface RawProject {
  name?: unknown
  slug?: unknown
  category?: unknown
  description?: unknown
  website_url?: unknown
  twitter_url?: unknown
  tasks?: unknown
}

interface ParsedTask {
  title: string
  task_type: string
  description: string | null
  difficulty: number
  deadline: string | null
}

interface ParsedProject {
  name: string
  slug: string
  category: string
  description: string | null
  website_url: string | null
  twitter_url: string | null
  tasks: ParsedTask[]
}

function isValidTaskType(v: unknown): v is string {
  return typeof v === 'string' && VALID_TASK_TYPES.includes(v)
}

function isValidCategory(v: unknown): v is string {
  return typeof v === 'string' && VALID_CATEGORIES.includes(v)
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Текст не предоставлен' }, { status: 400 })
    }
    if (text.length > 8000) {
      return NextResponse.json({ error: 'Текст слишком длинный (max 8000 символов)' }, { status: 400 })
    }

    const cacheKey = `thread-${hashKey(text)}`
    const cached = await getCachedAnalysis('parse_tasks', cacheKey, CACHE_TTL)
    if (cached) return NextResponse.json(cached)

    const prompt = `You parse crypto farming threads (Twitter, Discord, blogs) and extract ALL projects mentioned with their tasks.

Input text:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{"projects":[{"name":"ProjectName","slug":"projectname","category":"layer1|layer2|defi|infra|social|gaming|nft|other","description":"short description","website_url":null,"twitter_url":null,"tasks":[{"title":"Action","task_type":"bridge|swap|stake|mint|discord|social|testnet|quest","description":"detail","difficulty":1-5,"deadline":null}]}]}

Rules:
- Multiple projects in one thread → return all in projects array
- Each project gets its own tasks
- task_type MUST be one of: bridge, swap, stake, mint, discord, social, testnet, quest
- difficulty 1=trivial, 5=hard
- Use null for missing fields, never empty string
- slug = lowercase project name with hyphens
- If only ONE project, still wrap in projects array
- Return valid JSON only, no markdown fences, no commentary`

    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'You are a crypto thread parser API. Return ONLY valid JSON. No markdown, no explanations.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка AI сервиса' }, { status: 500 })
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || '{}'

    let parsed: { projects?: unknown }
    try {
      const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(clean)
    } catch {
      parsed = { projects: [] }
    }

    const rawProjects: RawProject[] = Array.isArray(parsed.projects) ? parsed.projects : []
    const projects: ParsedProject[] = rawProjects
      .filter((p): p is RawProject => !!p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim().length > 0)
      .map((p) => {
        const name = String(p.name).trim()
        const rawTasks: RawTask[] = Array.isArray(p.tasks) ? p.tasks : []
        const tasks: ParsedTask[] = rawTasks
          .filter((t): t is RawTask => !!t && typeof t === 'object' && typeof t.title === 'string' && t.title.trim().length > 0)
          .map((t) => ({
            title: String(t.title).trim().slice(0, 200),
            task_type: isValidTaskType(t.task_type) ? t.task_type : 'custom',
            description: typeof t.description === 'string' ? t.description.slice(0, 500) : null,
            difficulty: Math.min(5, Math.max(1, Number(t.difficulty) || 3)),
            deadline: typeof t.deadline === 'string' && t.deadline.length > 0 ? t.deadline : null,
          }))

        return {
          name,
          slug: typeof p.slug === 'string' && p.slug.length > 0 ? slugify(p.slug) : slugify(name),
          category: isValidCategory(p.category) ? p.category : 'other',
          description: typeof p.description === 'string' ? p.description.slice(0, 500) : null,
          website_url:
            typeof p.website_url === 'string' && p.website_url.startsWith('http') ? p.website_url : null,
          twitter_url:
            typeof p.twitter_url === 'string' && p.twitter_url.startsWith('http') ? p.twitter_url : null,
          tasks,
        }
      })

    const totalTasks = projects.reduce((s, p) => s + p.tasks.length, 0)
    const result = { projects, totalProjects: projects.length, totalTasks }

    void saveCachedAnalysis('parse_tasks', cacheKey, { kind: 'thread', text_preview: text.slice(0, 200) }, result)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const e = error as { name?: string; message?: string }
    if (e?.name === 'AbortError') {
      return NextResponse.json({ error: 'Таймаут AI' }, { status: 504 })
    }
    console.error('Parse thread error:', error)
    return NextResponse.json({ error: 'Ошибка парсинга' }, { status: 500 })
  }
}
