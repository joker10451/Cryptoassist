import { NextResponse } from 'next/server'
import { discoverProjects } from '@/lib/scraper'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    const discovered = await discoverProjects()
    
    let added = 0
    let updated = 0

    for (const project of discovered.protocols) {
      const slug = project.slug
      
      const { data: existing } = await supabase
        .from('projects')
        .select('id, updated_at')
        .eq('slug', slug)
        .single()

      if (!existing) {
        const { data } = await supabase
          .from('projects')
          .insert({
            name: project.name,
            slug,
            description: project.description,
            category: project.category,
            ecosystem: project.chain,
            website_url: project.website,
            twitter_url: project.twitter,
            probability_score: Math.floor(Math.random() * 30) + 40,
          })
          .select()
        
        if (data) added++
      } else {
        const { data } = await supabase
          .from('projects')
          .update({
            description: project.description || undefined,
            website_url: project.website || undefined,
            twitter_url: project.twitter || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('slug', slug)
        
        if (data) updated++
      }
    }

    for (const project of discovered.l2s) {
      const slug = project.slug
      
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!existing) {
        const { data } = await supabase
          .from('projects')
          .insert({
            name: project.name,
            slug,
            description: project.description,
            category: 'layer2',
            website_url: project.website,
            twitter_url: project.twitter,
            probability_score: Math.floor(Math.random() * 20) + 60,
          })
          .select()
        
        if (data) added++
      }
    }

    return NextResponse.json({
      success: true,
      added,
      updated,
      total: discovered.total,
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
