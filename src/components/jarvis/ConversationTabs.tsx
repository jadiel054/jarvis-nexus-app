import { Plus, MessageSquare } from 'lucide-react'
import { useConversationStore } from '@/store/useConversationStore'
import { useJarvisStore } from '@/store/useJarvisStore'

export default function ConversationTabs() {
  const { conversations, activeConversationId, setActiveConversation, createConversation } = useConversationStore()
  const { setShowNexus } = useJarvisStore()

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#00FFFF]/10 overflow-x-auto">
      <button
        onClick={() => {
          const id = createConversation()
          setActiveConversation(id)
        }}
        className="flex items-center gap-1 px-3 py-1.5 border border-[#00FFFF]/30 rounded text-xs font-mono text-[#00FFFF] whitespace-nowrap min-h-[44px] hover:bg-[#00FFFF]/10"
      >
        <MessageSquare size={14} />
        Nova conversa
      </button>

      {conversations.slice(0, 5).map(conv => (
        <button
          key={conv.id}
          onClick={() => setActiveConversation(conv.id)}
          className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap min-h-[44px] transition-colors ${
            conv.id === activeConversationId
              ? 'bg-[#00FFFF]/20 text-[#00FFFF] border border-[#00FFFF]/40'
              : 'text-[#37474F] hover:text-[#E0F7FA]'
          }`}
        >
          {conv.title.slice(0, 20)}...
        </button>
      ))}

      <button
        onClick={() => setShowNexus(true)}
        className="ml-auto flex items-center gap-1 px-3 py-1.5 border border-purple-400/30 rounded text-xs font-mono text-purple-400 whitespace-nowrap min-h-[44px] hover:bg-purple-400/10"
      >
        Nexus
      </button>

      <button className="p-2 text-[#37474F] hover:text-[#00FFFF] min-w-[44px] min-h-[44px] flex items-center justify-center">
        <Plus size={16} />
      </button>
    </div>
  )
}
