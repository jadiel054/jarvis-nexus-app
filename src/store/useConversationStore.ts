import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Conversation } from '@/types/jarvis'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  createConversation: () => string
  setActiveConversation: (id: string) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      messages: [],

      createConversation: () => {
        const id = crypto.randomUUID()
        const newConv: Conversation = {
          id,
          title: 'Nova conversa',
          messages: [],
          agentKey: 'default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: id,
          messages: [],
        }))
        return id
      },

      setActiveConversation: (id) => {
        const conv = get().conversations.find((c) => c.id === id)
        set({
          activeConversationId: id,
          messages: conv?.messages || [],
        })
      },

      addMessage: (message) => {
        set((state) => {
          const newMessages = [...state.messages, message]
          const conversations = state.conversations.map((c) =>
            c.id === state.activeConversationId
              ? { ...c, messages: newMessages, updatedAt: Date.now(), title: newMessages[0]?.content?.slice(0, 30) || c.title }
              : c
          )
          return { messages: newMessages, conversations }
        })
      },

      clearMessages: () => set({ messages: [] }),
    }),
    { name: 'jarvis-conversations' }
  )
)
