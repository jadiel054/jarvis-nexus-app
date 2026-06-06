import { create } from 'zustand'
import type { AgentTask } from '@/types/agent'

interface AgentState {
  plan: AgentTask[]
  addTask: (task: AgentTask) => void
  updateTask: (id: string, updates: Partial<AgentTask>) => void
  clearPlan: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  plan: [],
  addTask: (task) => set((state) => ({ plan: [...state.plan, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      plan: state.plan.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  clearPlan: () => set({ plan: [] }),
}))
