import React, { useState, useEffect } from 'react';
import { Settings, History } from 'lucide-react';

export default function ProtocolHeader({ protocolId, onOpenSettings, onOpenHistory }) {
  const [clock, setClock] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30 bg-[#050a0f]/90 backdrop-blur-md z-20 relative">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-cyan" />
          <span className="text-[10px] sm:text-xs font-mono text-cyan-400/70 tracking-widest uppercase">
            Protocol ID: {String(protocolId).padStart(5, '0')} // Secure Channel
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-600/50 capitalize">{date}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-cyan-300/80 tabular-nums">{clock}</span>
        <button
          onClick={onOpenHistory}
          className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-300"
          title="Histórico de conversas"
        >
          <History className="w-4 h-4 text-cyan-400/60" />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg border border-cyan-800/30 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-300"
          title="Configurações"
        >
          <Settings className="w-4 h-4 text-cyan-400/60" />
        </button>
      </div>
    </div>
  );
}