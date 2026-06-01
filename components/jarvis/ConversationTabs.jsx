import React from 'react';
import { Plus, X, MessageSquare } from 'lucide-react';

export default function ConversationTabs({ tabs, activeTabId, onSwitch, onNew, onClose }) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-cyan-900/30 bg-[#050a0f]/80 overflow-x-auto scrollbar-hide">
      {tabs.map(tab => (
        <div
          key={tab.id}
          onClick={() => onSwitch(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 flex-shrink-0 group
            ${tab.id === activeTabId
              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
              : 'border-cyan-900/30 hover:border-cyan-700/50 text-cyan-600/60 hover:text-cyan-400'
            }`}
        >
          <MessageSquare className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] font-mono max-w-[100px] truncate">{tab.title || 'Nova conversa'}</span>
          {tabs.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all ml-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onNew}
        className="flex-shrink-0 p-1.5 rounded-lg border border-cyan-900/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
        title="Nova conversa"
      >
        <Plus className="w-3 h-3 text-cyan-600/60 hover:text-cyan-400" />
      </button>
    </div>
  );
}