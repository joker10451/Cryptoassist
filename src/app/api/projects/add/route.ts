import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

async function generateTasks(projectData: any): Promise<any[]> {
  try {
    const prompt = `Ты — эксперт по крипто-фармингу. Для проекта "${projectData.name}" (${projectData.category}) сгенерируй конкретные задачи для фарминга аирдропа.

Проект: ${projectData.name}
Категория: ${projectData.category}
Экосистема: ${projectData.ecosystem}
Финансирование: ${projectData.funding || 'Неизвестно'}
Инвесторы: ${projectData.investors?.join(', ') || 'Неизвестно'}
Сайт: ${projectData.website || 'Нет'}
Twitter: ${projectData.twitter || 'Нет'}

Сгенерируй 6-10 конкретных задач. Включи: социальные (Discord, Twitter), ончейн (бридж, своп, стейк), квесты (Galxe, Layer3), тестнет.

Верни ТОЛЬКО JSON массив:
[{"title":"Задача","type":"discord|social|bridge|swap|stake|mint|testnet|quest","description":"Описание","difficulty":1-5,"url":"ссылка или null"}]`

    const res = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Верни ТОЛЬКО JSON массив. Без markdown, без объяснений.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
    const jsonMatch = clean.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }
}

async function scoreProject(projectData: any): Promise<any> {
  try {
    const prompt = `Оцени проект для аирдропа (0-100).

Проект: ${projectData.name}
Категория: ${projectData.category}
Финансирование: ${projectData.funding || 'Неизвестно'}
Инвесторы: ${projectData.investors?.join(', ') || 'Неизвестно'}
Токен: ${projectData.tokenStatus || 'no_token'}

Верни ТОЛЬКО JSON:
{"score":80,"expected_value_min":100,"expected_value_max":2000,"risk_level":"low|medium|high","alpha_summary":"1 предложение"}`

    const res = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Верни ТОЛЬКО JSON. Без markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 256,
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, text } = await req.json()

    if (!url && !text) {
      return NextResponse.json({ error: 'URL или текст обязательны' }, { status: 400 })
    }

    // Шаг 1: AI парсинг проекта
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

    const aiResponse = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
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

    // Шаг 2: AI оценка проекта
    const aiScore = await scoreProject(projectData)

    // Шаг 3: Сохранение проекта
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
        probability_score: aiScore?.score || projectData.probability || 50,
        estimated_reward_min: aiScore?.expected_value_min || 100,
        estimated_reward_max: aiScore?.expected_value_max || 1000,
        risk_score: aiScore?.risk_level === 'low' ? 3 : aiScore?.risk_level === 'high' ? 7 : 5,
        ai_summary: aiScore?.alpha_summary || projectData.summary,
        website_url: projectData.website,
        twitter_url: projectData.twitter,
        discord_url: projectData.discord,
      })
      .select()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Проект уже существует', slug }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const project = data[0]

    // Шаг 4: AI генерация задач
    const tasks = await generateTasks(projectData)

    let savedTasks = 0
    if (tasks.length > 0) {
      const taskRecords = tasks.map((t: any) => ({
        project_id: project.id,
        title: t.title,
        description: t.description || null,
        task_type: t.type || 'quest',
        difficulty: Math.min(5, Math.max(1, t.difficulty || 3)),
        url: t.url || null,
        status: 'pending',
      }))

      const { data: savedData } = await supabase
        .from('tasks')
        .insert(taskRecords)
        .select()

      savedTasks = savedData?.length || 0
    }

    return NextResponse.json({
      success: true,
      project,
      tasks_generated: savedTasks,
      tasks: tasks.slice(0, 3), // Показываем первые 3 для превью
      ai_score: aiScore,
    })
  } catch (error) {
    console.error('Add project error:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 })
  }
}
