'use client'

import { useEffect } from 'react'
import { useUserStore } from '@/store/userStore'
import { useSettingsStore } from '@/store/settingsStore'

export function StoreHydrator() {
  useEffect(() => {
    useUserStore.persist.rehydrate()
    useSettingsStore.persist.rehydrate()
  }, [])

  return null
}
