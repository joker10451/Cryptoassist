'use client'

import { useState, useEffect, useCallback } from 'react'
import { getProjects, getTasks, getAchievements } from '@/lib/supabase'
import { Project, Task, Achievement } from '@/types'

export function useSupabaseData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { projects, tasks, achievements, loading, refresh: fetchData }
}
