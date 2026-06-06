import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JarvisIntegrations } from '@/types/jarvis'

interface SettingsState {
  integrations: JarvisIntegrations
  setIntegration: (key: string, value: string) => void
  resetIntegrations: () => void
}

const defaultIntegrations: JarvisIntegrations = {
  activeModel: 'llama-3.3-70b-versatile',
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      integrations: defaultIntegrations,
      setIntegration: (key, value) =>
        set((state) => ({
          integrations: { ...state.integrations, [key]: value },
        })),
      resetIntegrations: () => set({ integrations: defaultIntegrations }),
    }),
    { name: 'jarvis-settings' }
  )
)
