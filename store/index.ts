"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, Message, Memory, EvolutionEntry, AgentStatus, Plan, Toast } from "@/types";

// ── CHAT STORE ────────────────────────────────────────────────
interface ChatState {
  conversations: Conversation[];
  activeConvId: string | null;
  messages: Message[];
  agentStatus: AgentStatus;
  streamingText: string;
  tokenCount: number;

  // actions
  setActiveConv: (id: string) => void;
  newConversation: () => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  pinConversation: (id: string) => void;
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  setAgentStatus: (s: AgentStatus) => void;
  setStreamingText: (t: string) => void;
  setTokenCount: (n: number) => void;
  persistMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConvId: null,
      messages: [],
      agentStatus: "idle",
      streamingText: "",
      tokenCount: 0,

      setActiveConv: (id) => {
        const conv = get().conversations.find(c => c.id === id);
        set({ activeConvId: id, messages: conv?.messages || [], streamingText: "" });
      },

      newConversation: () => {
        const id = `conv_${Date.now()}`;
        const conv: Conversation = { id, title: "Nova conversa", messages: [], created_at: Date.now(), updated_at: Date.now() };
        set(s => ({
          conversations: [...s.conversations.map(c => ({ ...c })), conv],
          activeConvId: id,
          messages: [],
          streamingText: "",
        }));
        return id;
      },

      deleteConversation: (id) => {
        set(s => {
          const remaining = s.conversations.filter(c => c.id !== id);
          const newActive = remaining.length > 0 ? remaining[remaining.length - 1] : null;
          return {
            conversations: remaining,
            activeConvId: newActive?.id || null,
            messages: newActive?.messages || [],
          };
        });
      },

      renameConversation: (id, title) => {
        set(s => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, title } : c) }));
      },

      pinConversation: (id) => {
        set(s => ({ conversations: s.conversations.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c) }));
      },

      addMessage: (msg) => {
        set(s => {
          const msgs = [...s.messages, msg];
          return { messages: msgs };
        });
      },

      updateMessage: (id, patch) => {
        set(s => ({ messages: s.messages.map(m => m.id === id ? { ...m, ...patch } : m) }));
      },

      setAgentStatus: (s) => set({ agentStatus: s }),
      setStreamingText: (t) => set({ streamingText: t }),
      setTokenCount: (n) => set({ tokenCount: n }),

      persistMessages: () => {
        const { activeConvId, messages, conversations } = get();
        if (!activeConvId) return;
        const firstMsg = messages.find(m => m.role === "user");
        const autoTitle = firstMsg?.content?.slice(0, 40) || "Conversa";
        set(s => ({
          conversations: s.conversations.map(c =>
            c.id === activeConvId
              ? { ...c, messages, updated_at: Date.now(), title: c.title === "Nova conversa" ? autoTitle : c.title }
              : c
          )
        }));
      },
    }),
    {
      name: "jarvis-chat",
      partialize: (s) => ({ conversations: s.conversations, activeConvId: s.activeConvId }),
    }
  )
);

// ── MEMORY STORE ─────────────────────────────────────────────
interface MemoryState {
  memories: Memory[];
  evolution: EvolutionEntry[];
  setMemories: (m: Memory[]) => void;
  addMemory: (m: Memory) => void;
  deleteMemory: (id: string) => void;
  clearMemories: () => void;
  addEvolutionEntry: (e: EvolutionEntry) => void;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set) => ({
      memories: [],
      evolution: [],
      setMemories: (memories) => set({ memories }),
      addMemory: (m) => set(s => ({ memories: [m, ...s.memories].slice(0, 500) })),
      deleteMemory: (id) => set(s => ({ memories: s.memories.filter(m => m.id !== id) })),
      clearMemories: () => set({ memories: [] }),
      addEvolutionEntry: (e) => set(s => ({ evolution: [e, ...s.evolution].slice(0, 200) })),
    }),
    { name: "jarvis-memory" }
  )
);

// ── UI STORE ─────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean;
  showSettings: boolean;
  showMemories: boolean;
  showIntegrations: boolean;
  toasts: Toast[];
  ttsEnabled: boolean;
  convSearch: string;
  activePlan: Plan | null;
  aiProvider: string;
  aiModel: string;

  setSidebarOpen: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowMemories: (v: boolean) => void;
  setShowIntegrations: (v: boolean) => void;
  showToast: (message: string, type?: Toast["type"], duration?: number) => void;
  setTtsEnabled: (v: boolean) => void;
  setConvSearch: (v: string) => void;
  setActivePlan: (p: Plan | null) => void;
  updatePlanStep: (index: number, status: string, note?: string) => void;
  setAiProvider: (p: string) => void;
  setAiModel: (m: string) => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  sidebarOpen: false,
  showSettings: false,
  showMemories: false,
  showIntegrations: false,
  toasts: [],
  ttsEnabled: false,
  convSearch: "",
  activePlan: null,
  aiProvider: "anthropic",
  aiModel: "claude-sonnet-4-6",

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowMemories: (v) => set({ showMemories: v }),
  setShowIntegrations: (v) => set({ showIntegrations: v }),

  showToast: (message, type = "info", duration = 2200) => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.map(t => t.id === id ? { ...t, out: true } : t) }));
      setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 250);
    }, duration);
  },

  setTtsEnabled: (v) => set({ ttsEnabled: v }),
  setConvSearch: (v) => set({ convSearch: v }),
  setActivePlan: (p) => set({ activePlan: p }),

  updatePlanStep: (index, status, note) => {
    const plan = get().activePlan;
    if (!plan) return;
    set({ activePlan: { ...plan, steps: plan.steps.map((s, i) => i === index ? { ...s, status: status as "pending"|"running"|"done"|"error"|"skipped", note } : s) } });
  },

  setAiProvider: (p) => set({ aiProvider: p }),
  setAiModel: (m) => set({ aiModel: m }),
}));
