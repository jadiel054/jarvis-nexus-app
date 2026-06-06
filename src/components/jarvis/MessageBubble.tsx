import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { MessageActionBar } from './MessageActionBar'
import { SentimentIndicator } from './SentimentIndicator'
import type { Message } from '@/types/jarvis'

interface Props {
  message: Message
  onFeedback: (type: 'like' | 'dislike') => void
  onRegenerate: () => void
}

export default function MessageBubble({ message, onFeedback, onRegenerate }: Props) {
  const isUser = message.role === 'user'

  const safeHtml = !isUser
    ? DOMPurify.sanitize(marked.parse(message.content) as string, {
        ALLOWED_TAGS: ['p','br','strong','em','code','pre','ul','ol','li','h1','h2','h3','h4','blockquote','a'],
        ALLOWED_ATTR: ['href', 'target', 'rel']
      })
    : null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
        isUser
          ? 'bg-jarvis-cyan/20 border border-jarvis-cyan/40 text-jarvis-text'
          : 'bg-jarvis-bg-card border border-jarvis-cyan/20 text-jarvis-text'
      }`}>
        {isUser ? (
          <>
            <SentimentIndicator text={message.content} />
            <p className="text-sm font-mono mt-1">{message.content}</p>
          </>
        ) : (
          <>
            {message.modelUsed && (
              <span className="text-xs font-mono text-jarvis-cyan/60 mb-1 block">
                {message.modelUsed}
              </span>
            )}
            <div
              className="prose prose-invert prose-sm max-w-none font-mono text-sm"
              dangerouslySetInnerHTML={{ __html: safeHtml! }}
            />
            <MessageActionBar
              message={message}
              onFeedback={onFeedback}
              onRegenerate={onRegenerate}
            />
          </>
        )}
      </div>
    </div>
  )
}
