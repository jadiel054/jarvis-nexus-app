import React from 'react';
import ReactMarkdown from 'react-markdown';
import SentimentIndicator from './SentimentIndicator';
import MessageActionBar from './MessageActionBar';

export default function MessageBubble({ message, onRegenerate, onSpeak, isSpeaking, onFeedback }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
      <div className={`max-w-[85%] sm:max-w-[75%] group`}>
        {/* Sender label */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {isUser && <SentimentIndicator text={message.content} />}
          <span className={`text-[10px] font-mono ${isUser ? 'text-teal-400/50' : 'text-cyan-400/50'}`}>
            {isUser ? 'VOCÊ' : 'J.A.R.V.I.S.'} • {time}
          </span>
        </div>

        {/* File previews */}
        {message.files && message.files.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.files.map((file, i) => (
              <div key={i} className="relative">
                {file.type === 'image' ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-32 h-32 object-cover rounded-lg border border-cyan-800/30"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-900/20 border border-cyan-800/30">
                    <span className="text-[10px] font-mono text-cyan-300">📄 {file.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-[#0a2a2a] border border-teal-700/30 rounded-tr-sm'
              : 'bg-[#0a1520] border-l-2 border-cyan-500/60 rounded-tl-sm border-t border-r border-b border-cyan-900/20'
          }`}
        >
          {isUser ? (
            <p className="text-sm text-teal-50 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="text-sm text-cyan-50/90 leading-relaxed prose prose-sm prose-invert max-w-none
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              prose-code:text-cyan-300 prose-code:bg-cyan-950/50 prose-code:px-1 prose-code:rounded
              prose-strong:text-cyan-200 prose-a:text-cyan-400">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action Bar — only for JARVIS messages */}
        {!isUser && (
          <MessageActionBar
            message={message}
            onRegenerate={onRegenerate}
            onSpeak={onSpeak}
            isSpeaking={isSpeaking}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}