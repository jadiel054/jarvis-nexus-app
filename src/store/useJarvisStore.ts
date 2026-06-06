import { create } from 'zustand'

interface JarvisState {
  combatMode: boolean
  showObservability: boolean
  showSettings: boolean
  showNexus: boolean
  setCombatMode: (v: boolean) => void
  setShowObservability: (v: boolean) => void
  setShowSettings: (v: boolean) => void
  setShowNexus: (v: boolean) => void
}

export const useJarvisStore = create<JarvisState>((set) => ({
  combatMode: false,
  showObservability: false,
  showSettings: false,
  showNexus: false,
  setCombatMode: (v) => set({ combatMode: v }),
  setShowObservability: (v) => set({ showObservability: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowNexus: (v) => set({ showNexus: v }),
}))
