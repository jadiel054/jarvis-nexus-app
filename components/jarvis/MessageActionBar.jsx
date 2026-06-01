import React, { useState } from 'react';
import { Copy, Volume2, VolumeX, RefreshCw, Share2, ThumbsUp, ThumbsDown, Check } from 'lucide-react';

export default function MessageActionBar({ message, onRegenerate, onSpeak, isSpeaking, onFeedback }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: message.content || '' }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message.content || '');
    }
  };

  const handleFeedback = (type) => {
    const next = feedback === type ? null : type;
    setFeedback(next);
    if (next) onFeedback?.(next);
  };

  const btnBase = 'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 hover:bg-cyan-500/10 active:scale-90';

  return (
    <div className="flex items-center gap-0.5 mt-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Copy */}
      <button
        onClick={handleCopy}
        title="Copiar"
        className={`${btnBase} ${copied ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>

      {/* TTS */}
      <button
        onClick={() => onSpeak?.(message.content)}
        title={isSpeaking ? 'Parar' : 'Falar'}
        className={`${btnBase} ${isSpeaking ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
      >
        {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>

      {/* Regenerate */}
      <button
        onClick={() => onRegenerate?.(message)}
        title="Regerar resposta"
        className={`${btnBase} text-slate-500 hover:text-cyan-400`}
      >
        <RefreshCw size={13} />
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        title="Compartilhar"
        className={`${btnBase} text-slate-500 hover:text-cyan-400`}
      >
        <Share2 size={13} />
      </button>

      {/* Divider */}
      <div className="w-px h-3.5 bg-cyan-900/40 mx-0.5" />

      {/* Like */}
      <button
        onClick={() => handleFeedback('like')}
        title="Curtir"
        className={`${btnBase} ${feedback === 'like' ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-400'}`}
      >
        <ThumbsUp size={13} />
      </button>

      {/* Dislike */}
      <button
        onClick={() => handleFeedback('dislike')}
        title="Não curtir"
        className={`${btnBase} ${feedback === 'dislike' ? 'text-orange-400' : 'text-slate-500 hover:text-orange-400'}`}
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}