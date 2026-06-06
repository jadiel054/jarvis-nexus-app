import { useState, useEffect, useRef } from 'react'
import { X, Send } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { AgentMessage } from '@/types/agent'

const AGENT_COLORS: Record<string, string> = {
  jarvis: 'text-jarvis-cyan border-jarvis-cyan/30',
  zarith: 'text-purple-400 border-purple-400/30',
  jadiel: 'text-jarvis-green border-jarvis-green/30',
}

const AGENT_ICONS: Record<string, string> = { jarvis: '🤖', zarith: '⚡', jadiel: '👤' }

export default function NexusChannel() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const { setShowNexus } = useJarvisStore()

  useEffect(() => {
    supabase.from('agent_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        setMessages((data as AgentMessage[]) || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('nexus-jadiel-view')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_messages' },
        (payload) => {
          setMessages(prev => [...prev, payload.new as AgentMessage])
        }
      ).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')

    await fetch('/api/nexus/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_agent: 'jadiel', to_agent: 'all', type: 'message', content: msg })
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-jarvis-bg-secondary border border-jarvis-cyan/30 rounded-t-xl w-full max-w-md h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-cyan/20">
          <div>
            <h3 className="text-jarvis-cyan font-mono text-sm font-bold">NEXUS CHANNEL</h3>
            <p className="text-jarvis-text-dim font-mono text-xs">Jarvis - Zarith - Jadiel</p>
          </div>
          <button onClick={() => setShowNexus(false)} className="text-jarvis-text-dim hover:text-jarvis-red min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-jarvis-text-dim font-mono text-sm text-center">Carregando...</p>
          ) : messages.length === 0 ? (
            <p className="text-jarvis-text-dim font-mono text-sm text-center">Nenhuma mensagem ainda</p>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.from_agent === 'jadiel' ? 'flex-row-reverse' : ''}`}>
                <span className="text-lg">{AGENT_ICONS[msg.from_agent] || '?'}</span>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 border bg-jarvis-bg ${AGENT_COLORS[msg.from_agent] || ''}`}>
                  <p className="text-xs font-mono opacity-60 mb-1 capitalize">{msg.from_agent}</p>
                  <p className="text-sm font-mono text-jarvis-text">{msg.content}</p>
                  {msg.status !== 'sent' && (
                    <span className="text-xs font-mono opacity-50 mt-1 block">{msg.status}</span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 border-t border-jarvis-cyan/20 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Mensagem para os agentes..."
            className="flex-1 bg-jarvis-bg border border-jarvis-text-dim/30 rounded px-3 py-2 text-jarvis-text font-mono text-sm focus:outline-none focus:border-jarvis-cyan min-h-[44px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-jarvis-cyan text-jarvis-bg rounded px-4 min-h-[44px] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
