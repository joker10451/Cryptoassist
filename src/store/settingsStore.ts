import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ThemeName = 'dark' | 'deep' | 'midnight'
export type AccentColor = 'cyan' | 'purple' | 'green' | 'blue' | 'orange'

export interface SettingsState {
  username: string
  email: string
  defaultNetwork: string
  notifications: {
    snapshots: boolean
    deadlines: boolean
    newOpportunities: boolean
    achievements: boolean
    weeklyReport: boolean
  }
  theme: ThemeName
  accentColor: AccentColor
  setUsername: (name: string) => void
  setEmail: (email: string) => void
  setDefaultNetwork: (network: string) => void
  setNotification: (key: keyof SettingsState['notifications'], value: boolean) => void
  setTheme: (theme: ThemeName) => void
  setAccentColor: (color: AccentColor) => void
  resetSettings: () => void
}

const defaultSettings = {
  username: 'Охотник',
  email: 'hunter@cryptoos.local',
  defaultNetwork: 'Ethereum',
  notifications: {
    snapshots: true,
    deadlines: true,
    newOpportunities: false,
    achievements: true,
    weeklyReport: false,
  },
  theme: 'dark' as ThemeName,
  accentColor: 'cyan' as AccentColor,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setUsername: (username) => set({ username }),
      setEmail: (email) => set({ email }),
      setDefaultNetwork: (defaultNetwork) => set({ defaultNetwork }),
      setNotification: (key, value) =>
        set((state) => ({
          notifications: { ...state.notifications, [key]: value },
        })),
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'crypto-hunter-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
      migrate: (persisted) => persisted as SettingsState,
    }
  )
)
