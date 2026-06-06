import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Plus, Trash2, X, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConversationHistory({ currentMessages, onLoadConversation, onNewConversation, onClose, userEmail }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Conversation.filter(
        { user_email: userEmail },
        '-last_message_at',
        20
      );
      setConversations(data);
    } catch (e) {
      console.warn('[ConversationHistory] Failed to load conversations:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) loadConversations();
  }, [userEmail]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await base44.entities.Conversation.delete(id);
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.warn('[ConversationHistory] Failed to delete conversation:', err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-80 h-full bg-[#0a1520] border-r border-cyan-800/30 flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/30">
          <div>
            <h2 className="text-sm font-semibold text-cyan-300">Histórico</h2>
            <p className="text-[10px] font-mono text-cyan-600/50">CONVERSAS SALVAS</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors">
            <X className="w-4 h-4 text-cyan-400/60" />
          </button>
        </div>

        {/* New Conversation */}
        <button
          onClick={() => { onNewConversation(); onClose(); }}
          className="mx-4 mt-4 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-500/30 
            bg-cyan-500/10 hover:bg-cyan-500/20 transition-all text-cyan-300 text-sm font-mono"
        >
          <Plus className="w-4 h-4" />
          Nova Conversa
        </button>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {loading ? (
            <div className="text-center text-cyan-600/50 text-xs font-mono py-8">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-cyan-600/40 text-xs font-mono py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma conversa salva
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => { onLoadConversation(conv); onClose(); }}
                className="w-full text-left px-3 py-3 rounded-xl border border-cyan-900/30 
                  hover:border-cyan-600/40 hover:bg-cyan-900/20 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-cyan-200 truncate font-mono">{conv.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-2.5 h-2.5 text-cyan-600/40" />
                      <span className="text-[10px] text-cyan-600/40">
                        {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR }) : '—'}
                      </span>
                    </div>
                    <p className="text-[10px] text-cyan-700/50 mt-0.5">{conv.messages?.length || 0} mensagens</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400/60" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}