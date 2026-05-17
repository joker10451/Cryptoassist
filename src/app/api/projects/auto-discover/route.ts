import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const TRENDING_PROJECTS = [
  { name: 'MegaETH', description: 'Real-time L2 blockchain. Raised $100M. Backed by Vitalik, Paradigm.', category: 'layer2', ecosystem: 'ethereum', website: 'https://megaeth.com', twitter: 'https://twitter.com/MegaETH_L2', funding: 100000000, investors: ['Paradigm', 'Vitalik'] },
  { name: 'Berachain', description: 'L1 with Proof-of-Liquidity consensus. Raised $100M from Polychain, Hack VC.', category: 'layer1', ecosystem: 'berachain', website: 'https://berachain.com', twitter: 'https://twitter.com/berachain', funding: 100000000, investors: ['Polychain', 'Hack VC'] },
  { name: 'Hyperlane', description: 'Interoperability protocol for cross-chain messaging. Raised $20M from a16z.', category: 'infra', ecosystem: 'multi-chain', website: 'https://hyperlane.xyz', twitter: 'https://twitter.com/Hyperlane_xyz', funding: 20000000, investors: ['a16z', 'Polychain'] },
  { name: 'Scroll', description: 'zkEVM Layer 2 scaling solution for Ethereum. Raised $80M.', category: 'layer2', ecosystem: 'ethereum', website: 'https://scroll.io', twitter: 'https://twitter.com/Scroll_ZKP', funding: 80000000, investors: ['Polychain', 'Bain Capital'] },
  { name: 'Initia', description: 'Network for interwoven rollups. Raised $12M from Binance Labs.', category: 'infra', ecosystem: 'cosmos', website: 'https://initia.xyz', twitter: 'https://twitter.com/initia_xyz', funding: 12000000, investors: ['Binance Labs', 'Delphi Digital'] },
  { name: 'Fuel Network', description: 'Modular execution layer with parallel execution. Raised $27.5M.', category: 'layer2', ecosystem: 'ethereum', website: 'https://fuel.network', twitter: 'https://twitter.com/FuelLabs_', funding: 27500000, investors: ['Blockchain Capital', 'Fabric Ventures'] },
  { name: 'Aztec Network', description: 'Privacy-focused zkEVM Layer 2. Raised $100M from a16z, Paradigm.', category: 'layer2', ecosystem: 'ethereum', website: 'https://aztec.network', twitter: 'https://twitter.com/aztecnetwork', funding: 100000000, investors: ['a16z', 'Paradigm'] },
]

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
        newProjects.push({ name: result[0]?.name || project.name, probability: result[0]?.probability_score })
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
