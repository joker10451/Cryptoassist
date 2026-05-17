'use client'

import { useState, useEffect } from 'react'
import { getProjects, getTasks, getAchievements } from '@/lib/supabase'
import { Project, Task, Achievement } from '@/types'

export function useAppData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectsData, tasksData, achievementsData] = await Promise.all([
          getProjects(),
          getTasks(),
          getAchievements(),
        ])

        setProjects(projectsData as Project[])
        setTasks(tasksData as Task[])
        setAchievements(achievementsData as Achievement[])
      } catch (error) {
        console.error('Fetch failed:', error)
        setProjects([])
        setTasks([])
        setAchievements([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { projects, tasks, achievements, loading }
}
