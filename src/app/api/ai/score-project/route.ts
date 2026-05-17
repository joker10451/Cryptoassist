import { NextRequest, NextResponse } from 'next/server'
import { getCachedAnalysis, saveCachedAnalysis, hashKey } from '@/lib/aiCache'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const CACHE_TTL = 10 * 60 * 1000

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

export async function POST(req: NextRequest) {
  try {
    const { name, category, funding, investors, tokenStatus, description, chains, tvl, signals } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'Название проекта обязательно' }, { status: 400 })
    }

    const cacheKey = `score-v2-${hashKey(JSON.stringify({ name, category, funding, investors, tokenStatus, chains, tvl }))}`
    const cached = await getCachedAnalysis('score_project', cacheKey, CACHE_TTL)
    if (cached) {
      return NextResponse.json(cached)
    }

    const prompt = `You are an elite crypto research analyst and venture scout working for a top-tier crypto fund (Paradigm / a16z level).

Analyze this crypto project:

Project: ${name}
Category: ${category || 'Unknown'}
Funding: ${funding ? `$${funding}` : 'Unknown'}
Investors: ${investors?.join(', ') || 'Unknown'}
Token Status: ${tokenStatus || 'Unknown'}
Description: ${description || 'No description'}
Chains: ${chains?.join(', ') || 'Unknown'}
TVL: ${tvl ? `$${tvl}` : 'Unknown'}
Recent Signals: ${signals?.join(', ') || 'No recent signals'}

Evaluate using this scoring model (0-100):

1. Airdrop Probability (0-25):
   - No token launched yet? +points
   - Points system exists? +points
   - History of retroactive rewards? +points

2. Expected Value (0-25):
   - VC funding quality (Paradigm, a16z, Coinbase = top tier)
   - Ecosystem importance
   - User adoption potential

3. Farming Signal Strength (0-20):
   - Testnet available
   - Quests / Galxe / Layer3 campaigns
   - Onchain activity required

4. Momentum (0-15):
   - Twitter growth
   - Hype increase
   - Developer activity

5. Risk (subtract 0-15):
   - Scam risk
   - Overhyped / already saturated
   - No clear incentive structure

Classification:
90-100: LEGENDARY_ALPHA (farm immediately)
75-89: HIGH_PRIORITY (strong opportunity)
50-74: MEDIUM (selective farming)
30-49: LOW (skip unless low effort)
0-29: NOISE (ignore)

Return ONLY valid JSON:
{
  "score": 78,
  "category": "HIGH_PRIORITY",
  "expected_value_min": 500,
  "expected_value_max": 5000,
  "time_to_farm": "medium",
  "risk_level": "low",
  "key_signals": ["signal 1", "signal 2"],
  "why_this_score": "short clear explanation",
  "what_to_do_next": ["action 1", "action 2", "action 3"],
  "red_flags": ["flag 1"],
  "alpha_summary": "1-2 sentence summary"
}`

    const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'You are a crypto analyst API. Return ONLY valid JSON. No markdown, no explanations, no code blocks.' },
          { role: 'user', content: prompt }
        ],
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
      const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = {
        score: 50,
        category: 'MEDIUM',
        expected_value_min: 100,
        expected_value_max: 1000,
        time_to_farm: 'medium',
        risk_level: 'medium',
        key_signals: ['Недостаточно данных'],
        why_this_score: 'Нет данных для анализа',
        what_to_do_next: ['Изучите проект'],
        red_flags: [],
        alpha_summary: 'Требуется больше информации',
      }
    }

    const result = {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
      category: parsed.category || 'MEDIUM',
      expected_value_min: typeof parsed.expected_value_min === 'number' ? parsed.expected_value_min : 100,
      expected_value_max: typeof parsed.expected_value_max === 'number' ? parsed.expected_value_max : 1000,
      time_to_farm: parsed.time_to_farm || 'medium',
      risk_level: parsed.risk_level || 'medium',
      key_signals: Array.isArray(parsed.key_signals) ? parsed.key_signals : [],
      why_this_score: parsed.why_this_score || '',
      what_to_do_next: Array.isArray(parsed.what_to_do_next) ? parsed.what_to_do_next : [],
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      alpha_summary: parsed.alpha_summary || '',
    }

    void saveCachedAnalysis('score_project', cacheKey, { name, category, tokenStatus }, result)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Таймаут AI' }, { status: 504 })
    }
    console.error('Score error:', error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
