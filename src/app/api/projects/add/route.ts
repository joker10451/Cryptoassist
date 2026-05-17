import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function saveProject(pd: any) {
  const slug = pd.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const projectData = {
    name: pd.name, slug, description: pd.summary, category: pd.category || 'layer1',
    ecosystem: pd.ecosystem, funding_amount: pd.funding, investors: pd.investors || [],
    token_status: pd.tokenStatus || 'no_token', probability_score: pd.probability || 50,
    estimated_reward_min: 100, estimated_reward_max: 1000, risk_score: 5,
    website_url: pd.website, twitter_url: pd.twitter, discord_url: pd.discord,
  }

  const res = await fetch(SUPABASE_URL + '/rest/v1/projects', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(projectData),
  })

  if (!res.ok) throw new Error('Supabase: ' + res.status)
  const data = await res.json()
  return data[0]
}

async function generateTasks(projectId: string, projectName: string, category: string) {
  const prompt = `Generate 5 farming tasks for "${projectName}" (${category}). Return ONLY JSON array: [{"title":"Task","type":"discord|social|bridge|swap|stake|mint|testnet|quest","description":"Desc","difficulty":1-5}]`

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NVIDIA_API_KEY },
    body: JSON.stringify({ model: 'meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 512 }),
  })

  if (!res.ok) return 0

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || '[]'
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
  const m = clean.match(/\[[\s\S]*\]/)
  const tasks = m ? JSON.parse(m[0]) : []

  if (tasks.length === 0) return 0

  const taskRecords = tasks.map((t: any) => ({
    project_id: projectId, title: t.title || 'Task', description: t.description || null,
    task_type: t.type || 'quest', difficulty: Math.min(5, Math.max(1, t.difficulty || 3)), status: 'pending',
  }))

  const saveRes = await fetch(SUPABASE_URL + '/rest/v1/tasks', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(taskRecords),
  })

  if (!saveRes.ok) return 0
  const saved = await saveRes.json()
  return saved?.length || 0
}

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

    const project = await saveProject(pd)
    const tasksGenerated = await generateTasks(project.id, pd.name, pd.category || 'layer1')

    return NextResponse.json({ success: true, project, tasks_generated: tasksGenerated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
