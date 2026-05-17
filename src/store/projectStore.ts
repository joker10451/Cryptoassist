import { create } from 'zustand'
import { Project, UserProject } from '@/types'

interface ProjectStore {
  projects: Project[]
  userProjects: UserProject[]
  selectedProject: Project | null
  setProjects: (projects: Project[]) => void
  setUserProjects: (userProjects: UserProject[]) => void
  setSelectedProject: (project: Project | null) => void
  addUserProject: (userProject: UserProject) => void
  updateUserProjectProgress: (id: string, progress: number) => void
}

export const useProjectStore = create<ProjectStore>()((set) => ({
  projects: [],
  userProjects: [],
  selectedProject: null,
  setProjects: (projects) => set({ projects }),
  setUserProjects: (userProjects) => set({ userProjects }),
  setSelectedProject: (project) => set({ selectedProject: project }),
  addUserProject: (userProject) =>
    set((state) => ({ userProjects: [...state.userProjects, userProject] })),
  updateUserProjectProgress: (id, progress) =>
    set((state) => ({
      userProjects: state.userProjects.map((up) =>
        up.id === id ? { ...up, progress } : up
      ),
    })),
}))
