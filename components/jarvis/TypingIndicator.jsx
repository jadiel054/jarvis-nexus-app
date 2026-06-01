import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="max-w-[85%]">
        <div className="text-[10px] font-mono mb-1 text-cyan-400/50">
          J.A.R.V.I.S. • processando...
        </div>
        <div className="bg-[#0a1520] border-l-2 border-cyan-500/60 border-t border-r border-b border-cyan-900/20 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot-1" />
            <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot-2" />
            <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot-3" />
          </div>
        </div>
      </div>
    </div>
  );
}