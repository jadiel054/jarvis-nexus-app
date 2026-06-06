import { useState, useRef } from 'react'
import { Paperclip, Mic, Send, MicOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSpeech } from '@/hooks/useSpeech'

interface Props {
  onSend: (text: string, files?: File[]) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [lastSentAt, setLastSentAt] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const { isListening, startListening, stopListening } = useSpeech((transcript) => {
    setText(prev => prev + ' ' + transcript)
  })

  function handleSend() {
    const now = Date.now()
    if (now - lastSentAt < 1000) return
    if (!text.trim() && !files.length) return

    setLastSentAt(now)
    onSend(text.trim(), files)
    setText('')
    setFiles([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <span key={i} className="text-xs bg-jarvis-bg-card border border-jarvis-cyan/30 rounded px-2 py-1 font-mono text-jarvis-text-dim">
              {f.name}
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="ml-2 text-jarvis-red">x</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-jarvis-bg-card border border-jarvis-cyan/30 rounded-xl px-3 py-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-jarvis-text-dim hover:text-jarvis-cyan transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => setFiles(Array.from(e.target.files || []))}
        />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Awaiting command override..."
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-jarvis-text font-mono text-base resize-none focus:outline-none placeholder:text-jarvis-text-dim disabled:opacity-50 min-h-[44px] max-h-32 py-2"
          style={{ lineHeight: '1.5' }}
        />

        <button
          onClick={isListening ? stopListening : startListening}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
            isListening ? 'text-jarvis-red animate-pulse' : 'text-jarvis-text-dim hover:text-jarvis-cyan'
          }`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <motion.button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !files.length)}
          whileTap={{ scale: 0.9 }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-jarvis-bg bg-jarvis-cyan rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  )
}
