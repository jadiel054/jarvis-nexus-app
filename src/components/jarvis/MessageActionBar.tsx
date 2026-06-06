import { useState } from 'react'
import { Copy, RefreshCw, Share2, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import type { Message } from '@/types/jarvis'

interface Props {
  message: Message
  onFeedback: (type: 'like' | 'dislike') => void
  onRegenerate: () => void
}

export function MessageActionBar({ message, onFeedback, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)

  function handleCopy() {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleFeedback(type: 'like' | 'dislike') {
    setFeedback(type)
    onFeedback(type)
  }

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={handleCopy} className="p-1.5 text-[#37474F] hover:text-[#00FFFF] min-w-[36px] min-h-[36px] flex items-center justify-center">
        {copied ? <Check size={14} className="text-[#00FF88]" /> : <Copy size={14} />}
      </button>
      <button onClick={onRegenerate} className="p-1.5 text-[#37474F] hover:text-[#00FFFF] min-w-[36px] min-h-[36px] flex items-center justify-center">
        <RefreshCw size={14} />
      </button>
      <button onClick={() => navigator.share?.({ text: message.content })} className="p-1.5 text-[#37474F] hover:text-[#00FFFF] min-w-[36px] min-h-[36px] flex items-center justify-center">
        <Share2 size={14} />
      </button>
      <div className="w-px h-4 bg-[#37474F]/30 mx-1" />
      <button onClick={() => handleFeedback('like')} className={`p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center ${feedback === 'like' ? 'text-[#00FFFF]' : 'text-[#37474F] hover:text-[#00FFFF]'}`}>
        <ThumbsUp size={14} />
      </button>
      <button onClick={() => handleFeedback('dislike')} className={`p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center ${feedback === 'dislike' ? 'text-orange-400' : 'text-[#37474F] hover:text-orange-400'}`}>
        <ThumbsDown size={14} />
      </button>
    </div>
  )
}
