import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/store/useJarvisStore'
import { useConversationStore } from '@/store/useConversationStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAgentStore } from '@/store/useAgentStore'
import { useMobile } from '@/hooks/useMobile'
import { callJarvisAPI } from '@/lib/apiClient'
import { detectAgentMode, detectBuiltinTool, executeBuiltin } from '@/components/jarvis/agents/agentRouter'
import { buildSystemPrompt } from '@/components/jarvis/agents/agentPrompts'
import ProtocolHeader from '@/components/jarvis/ProtocolHeader'
import ChatInput from '@/components/jarvis/ChatInput'
import MessageBubble from '@/components/jarvis/MessageBubble'
import ThinkingStatus from '@/components/jarvis/ThinkingStatus'
import AgentPlanningPanel from '@/components/jarvis/AgentPlanningPanel'
import ConversationTabs from '@/components/jarvis/ConversationTabs'
import HudOverlay from '@/components/jarvis/HudOverlay'
import DeployMonitor from '@/components/jarvis/DeployMonitor'
import ObservabilityPanel from '@/components/jarvis/ObservabilityPanel'
import SettingsPanel from '@/components/jarvis/SettingsPanel'
import NexusChannel from '@/components/jarvis/NexusChannel'

export default function Jarvis() {
  const { showObservability, showSettings, showNexus } = useJarvisStore()
  const { messages, addMessage } = useConversationStore()
  const { integrations } = useSettingsStore()
  const { plan } = useAgentStore()
  const { chatEndRef } = useMobile()
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingAgent, setThinkingAgent] = useState('JARVIS')

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatEndRef])

  async function handleSend(text: string, _files?: File[]) {
    if (!text.trim()) return

    const userMessage = { id: crypto.randomUUID(), role: 'user' as const, content: text, timestamp: Date.now() }
    addMessage(userMessage)

    const builtin = detectBuiltinTool(text)
    if (builtin) {
      const result = executeBuiltin(builtin)
      addMessage({ id: crypto.randomUUID(), role: 'assistant', content: result, timestamp: Date.now(), modelUsed: 'builtin' })
      return
    }

    const { agentKey, isAgentMode } = detectAgentMode(text)

    setIsThinking(true)
    setThinkingAgent(isAgentMode ? 'Agente Full-stack' : 'JARVIS')

    try {
      const systemPrompt = await buildSystemPrompt(agentKey, integrations)
      const response = await callJarvisAPI('/api/ai/chat', {
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }],
        model: integrations.activeModel || 'llama-3.3-70b-versatile',
        systemPrompt
      }, integrations)

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        modelUsed: response.modelUsed,
        isAgentMode
      })
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erro: ${String(err)}. Verifique suas API keys nas configurações.`,
        timestamp: Date.now(),
        isError: true
      })
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-jarvis-bg overflow-hidden relative">
      <HudOverlay />
      <ProtocolHeader />
      <ConversationTabs />
      <DeployMonitor />

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {plan.length > 0 && <AgentPlanningPanel />}

        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <MessageBubble message={msg} onFeedback={() => {}} onRegenerate={() => handleSend(msg.content)} />
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && <ThinkingStatus agentName={thinkingAgent} />}
        <div ref={chatEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isThinking} />

      {showObservability && <ObservabilityPanel />}
      {showSettings && <SettingsPanel />}
      {showNexus && <NexusChannel />}
    </div>
  )
}
