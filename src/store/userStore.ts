import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface UserState {
  xp: number
  farmerLevel: number
  streakDays: number
  projectsTracked: number
  projectsCompleted: number
  tasksDone: number
  walletsCount: number
  estimatedPortfolioValue: number
  incrementXP: (amount: number) => void
  incrementStreak: () => void
  incrementProjectsTracked: () => void
  incrementProjectsCompleted: () => void
  incrementTasksDone: () => void
  incrementWalletsCount: () => void
  decrementWalletsCount: () => void
  setPortfolioValue: (value: number) => void
  reset: () => void
}

const xpForLevel = (level: number) => level * 500

const initialState = {
  xp: 0,
  farmerLevel: 1,
  streakDays: 1,
  projectsTracked: 0,
  projectsCompleted: 0,
  tasksDone: 0,
  walletsCount: 0,
  estimatedPortfolioValue: 0,
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      incrementXP: (amount: number) =>
        set((state) => {
          const newXP = state.xp + amount
          let newLevel = state.farmerLevel
          while (newXP >= xpForLevel(newLevel)) newLevel++
          return { xp: newXP, farmerLevel: newLevel }
        }),

      incrementStreak: () => set((state) => ({ streakDays: state.streakDays + 1 })),
      incrementProjectsTracked: () => set((state) => ({ projectsTracked: state.projectsTracked + 1 })),
      incrementProjectsCompleted: () => set((state) => ({ projectsCompleted: state.projectsCompleted + 1 })),
      incrementTasksDone: () => set((state) => ({ tasksDone: state.tasksDone + 1 })),
      incrementWalletsCount: () => set((state) => ({ walletsCount: state.walletsCount + 1 })),
      decrementWalletsCount: () => set((state) => ({ walletsCount: Math.max(0, state.walletsCount - 1) })),
      setPortfolioValue: (value: number) => set({ estimatedPortfolioValue: value }),
      reset: () => set(initialState),
    }),
    {
      name: 'crypto-hunter-user',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
      migrate: (persisted) => persisted as UserState,
    }
  )
)
