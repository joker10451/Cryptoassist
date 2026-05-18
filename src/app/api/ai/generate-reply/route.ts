import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 15000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return response
  } catch {
    clearTimeout(id)
    throw new Error('Timeout')
  }
}

/**
 * POST /api/ai/generate-reply
 *   body: { post: string, style?: 'bold' | 'expert' | 'chaos' | 'proof' | 'auto' }
 *
 *   Генерирует 3 варианта reply на чужой пост в стиле ZeroFilter.
 *   Не кешируем — каждый раз свежий ответ.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const post = typeof body?.post === 'string' ? body.post.trim() : ''
    if (!post || post.length < 10) {
      return NextResponse.json({ error: 'Вставь пост (минимум 10 символов)' }, { status: 400 })
    }
    if (post.length > 2000) {
      return NextResponse.json({ error: 'Пост слишком длинный (max 2000)' }, { status: 400 })
    }

    if (!NVIDIA_API_KEY) {
      return NextResponse.json({ error: 'NVIDIA_API_KEY not configured' }, { status: 500 })
    }

    const style = body?.style || 'auto'

    const prompt = `You are KRIRIK — a crypto farmer with the "Zero Filter" brand on X (Twitter).
Your voice: sharp, concise, no emojis, no "nice thread", no begging.
You add VALUE in replies: facts, patterns, counter-arguments, personal proof.
Max 240 characters per reply. English only.

The user will paste someone else's tweet. Generate exactly 3 reply variants.
${style !== 'auto' ? `Preferred style: ${style}` : 'Mix styles: one bold/contrarian, one expert/factual, one personal-proof.'}

Rules:
- Never shill your own projects or drop links
- Never say "great thread" / "this" / "100%"
- Be specific: mention tickers, numbers, patterns when relevant
- Sound like someone who actually farms, not someone who reads about it
- Keep it under 240 chars each
- No hashtags

Return ONLY valid JSON:
{"replies":["reply 1","reply 2","reply 3"]}

Tweet to reply to:
"""
${post}
"""`

    const response = await fetchWithTimeout(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages: [
            { role: 'system', content: 'Return ONLY valid JSON. No markdown, no commentary.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 512,
        }),
      },
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'AI сервис недоступен' }, { status: 502 })
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || ''
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()

    let replies: string[] = []

    // Пробуем как {replies:[...]}
    const objMatch = clean.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0])
        if (Array.isArray(parsed.replies)) {
          replies = parsed.replies.filter((r: unknown) => typeof r === 'string' && r.length > 5)
        }
      } catch { /* fallthrough */ }
    }

    // Пробуем как голый массив ["...", "...", "..."]
    if (replies.length === 0) {
      const arrMatch = clean.match(/\[[\s\S]*\]/)
      if (arrMatch) {
        try {
          const arr = JSON.parse(arrMatch[0])
          if (Array.isArray(arr)) {
            replies = arr.filter((r: unknown) => typeof r === 'string' && r.length > 5)
          }
        } catch { /* fallthrough */ }
      }
    }

    // Последний fallback: разбиваем по нумерации "1.", "2.", "3."
    if (replies.length === 0 && clean.length > 20) {
      const lines = clean.split(/\n\s*\d+[\.\)]\s*/).filter((l) => l.trim().length > 10)
      if (lines.length >= 2) {
        replies = lines.slice(0, 3).map((l) => l.trim().replace(/^["']|["']$/g, ''))
      }
    }

    if (replies.length === 0) {
      console.warn('[generate-reply] unparseable response:', clean.slice(0, 300))
      return NextResponse.json({ error: 'AI вернул невалидный ответ, попробуй ещё раз' }, { status: 502 })
    }

    return NextResponse.json({ replies: replies.slice(0, 3) })
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e?.name === 'AbortError' || e?.message === 'Timeout') {
      return NextResponse.json({ error: 'Таймаут AI' }, { status: 504 })
    }
    console.error('[generate-reply]', err)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
