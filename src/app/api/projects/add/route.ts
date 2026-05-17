import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { url, text } = await req.json()

    if (!url && !text) {
      return NextResponse.json({ error: 'URL или текст обязательны' }, { status: 400 })
    }

    // AI парсинг для извлечения информации о проекте
    const prompt = `Извлеки информацию о крипто-проекте из текста/URL.

${text || url}

Ответь ТОЛЬКО в формате JSON:
{
  "name": "название проекта",
  "category": "layer1|layer2|defi|infra|nft|gaming",
  "ecosystem": "ethereum|solana|cosmos|multi-chain",
  "funding": число в USD или null,
  "investors": ["инвестор1", "инвестор2"],
  "tokenStatus": "no_token|rumored|announced|launched",
  "probability": число 1-100,
  "summary": "краткое описание на русском",
  "website": "URL или null",
  "twitter": "URL или null",
  "discord": "URL или null"
}`

    const aiResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
      }),
    })

    if (!aiResponse.ok) {
      return NextResponse.json({ error: 'AI ошибка' }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || '{}'

    let projectData
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      projectData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Ошибка парсинга AI ответа' }, { status: 500 })
    }

    // Сохранение в Supabase
    const slug = projectData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: projectData.name,
        slug,
        description: projectData.summary,
        category: projectData.category,
        ecosystem: projectData.ecosystem,
        funding_amount: projectData.funding,
        investors: projectData.investors || [],
        token_status: projectData.tokenStatus,
        probability_score: projectData.probability,
        website_url: projectData.website,
        twitter_url: projectData.twitter,
        discord_url: projectData.discord,
        ai_summary: projectData.summary,
      })
      .select()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Проект уже существует', slug }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, project: data[0] })
  } catch (error) {
    console.error('Add project error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
