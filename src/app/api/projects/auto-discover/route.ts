import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || ''

const TRENDING_PROJECTS = [
  { name: 'MegaETH', description: 'Real-time L2 blockchain. Raised $100M. Backed by Vitalik, Paradigm.', category: 'layer2', ecosystem: 'ethereum', website: 'https://megaeth.com', twitter: 'https://twitter.com/MegaETH_L2', funding: 100000000, investors: ['Paradigm', 'Vitalik'] },
  { name: 'Berachain', description: 'L1 with Proof-of-Liquidity consensus. Raised $100M from Polychain, Hack VC.', category: 'layer1', ecosystem: 'berachain', website: 'https://berachain.com', twitter: 'https://twitter.com/berachain', funding: 100000000, investors: ['Polychain', 'Hack VC'] },
  { name: 'Hyperlane', description: 'Interoperability protocol for cross-chain messaging. Raised $20M from a16z.', category: 'infra', ecosystem: 'multi-chain', website: 'https://hyperlane.xyz', twitter: 'https://twitter.com/Hyperlane_xyz', funding: 20000000, investors: ['a16z', 'Polychain'] },
  { name: 'Scroll', description: 'zkEVM Layer 2 scaling solution for Ethereum. Raised $80M.', category: 'layer2', ecosystem: 'ethereum', website: 'https://scroll.io', twitter: 'https://twitter.com/Scroll_ZKP', funding: 80000000, investors: ['Polychain', 'Bain Capital'] },
  { name: 'Initia', description: 'Network for interwoven rollups. Raised $12M from Binance Labs.', category: 'infra', ecosystem: 'cosmos', website: 'https://initia.xyz', twitter: 'https://twitter.com/initia_xyz', funding: 12000000, investors: ['Binance Labs', 'Delphi Digital'] },
  { name: 'Fuel Network', description: 'Modular execution layer with parallel execution. Raised $27.5M.', category: 'layer2', ecosystem: 'ethereum', website: 'https://fuel.network', twitter: 'https://twitter.com/FuelLabs_', funding: 27500000, investors: ['Blockchain Capital', 'Fabric Ventures'] },
  { name: 'Aztec Network', description: 'Privacy-focused zkEVM Layer 2. Raised $100M from a16z, Paradigm.', category: 'layer2', ecosystem: 'ethereum', website: 'https://aztec.network', twitter: 'https://twitter.com/aztecnetwork', funding: 100000000, investors: ['a16z', 'Paradigm'] },
]

async function generateTasks(project: any): Promise<any[]> {
  try {
    const prompt = `Generate 5-8 farming tasks for crypto project "${project.name}" (${project.category}).

Include: social tasks (Discord, Twitter), onchain tasks (bridge, swap, stake), quests (Galxe, Layer3), testnet if available.

Return ONLY JSON array:
[{"title":"Task","type":"discord|social|bridge|swap|stake|mint|testnet|quest","description":"Description","difficulty":1-5}]`

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: 'Return ONLY JSON array. No markdown.' },
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

async function checkExisting(slug: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?slug=eq.${slug}&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const data = await res.json()
  return data.length > 0
}

async function insertProject(project: any, slug: string) {
  const body = {
    name: project.name,
    slug,
    description: project.description,
    category: project.category,
    ecosystem: project.ecosystem,
    website_url: project.website,
    twitter_url: project.twitter,
    funding_amount: project.funding,
    investors: project.investors,
    probability_score: Math.floor(Math.random() * 25) + 65,
    estimated_reward_min: Math.floor(Math.random() * 200) + 100,
    estimated_reward_max: Math.floor(Math.random() * 2000) + 500,
    risk_score: Math.floor(Math.random() * 3) + 3,
    token_status: 'no_token',
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    return { error, status: res.status }
  }

  return await res.json()
}

export async function POST() {
  try {
    let added = 0
    let skipped = 0
    const errors: string[] = []
    const newProjects: any[] = []

    for (const project of TRENDING_PROJECTS) {
      const slug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')

      const exists = await checkExisting(slug)
      if (exists) {
        skipped++
        continue
      }

      const result = await insertProject(project, slug)
      if ('error' in result) {
        errors.push(`${project.name}: ${result.error}`)
      } else {
        added++
        const projectId = result[0]?.id
        const projectName = result[0]?.name || project.name
        const probability = result[0]?.probability_score

        // Генерируем задачи для нового проекта
        const tasks = await generateTasks(project)
        let tasksSaved = 0
        if (tasks.length > 0 && projectId) {
          const taskRecords = tasks.map((t: any) => ({
            project_id: projectId,
            title: t.title,
            description: t.description || null,
            task_type: t.type || 'quest',
            difficulty: Math.min(5, Math.max(1, t.difficulty || 3)),
            status: 'pending',
          }))

          const tasksRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(taskRecords),
          })

          if (tasksRes.ok) {
            const savedTasks = await tasksRes.json()
            tasksSaved = savedTasks?.length || 0
          }
        }

        newProjects.push({
          name: projectName,
          probability,
          tasks_generated: tasksSaved,
        })
      }
    }

    return NextResponse.json({
      success: true,
      added,
      skipped,
      errors: errors.slice(0, 3),
      new_projects: newProjects,
    })
  } catch (error) {
    console.error('Auto-discover error:', error)
    return NextResponse.json({ error: 'Ошибка авто-обнаружения' }, { status: 500 })
  }
}
