import { NextResponse } from 'next/server'
import { discoverProjects } from '@/lib/scraper'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const discovered = await discoverProjects()

    // Сохраняем новые проекты в БД
    const saved = []
    
    for (const project of discovered.protocols) {
      const slug = project.slug
      
      // Проверяем существует ли
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
            category: project.category,
            ecosystem: project.chain,
            website_url: project.website,
            twitter_url: project.twitter,
            probability_score: Math.floor(Math.random() * 30) + 40, // 40-70 для новых
          })
          .select()
        
        if (data) saved.push(data[0])
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
            probability_score: Math.floor(Math.random() * 20) + 60, // 60-80 для L2
          })
          .select()
        
        if (data) saved.push(data[0])
      }
    }

    return NextResponse.json({
      success: true,
      discovered,
      saved,
      savedCount: saved.length,
    })
  } catch (error) {
    console.error('Discover error:', error)
    return NextResponse.json({ error: 'Ошибка обнаружения проектов' }, { status: 500 })
  }
}
