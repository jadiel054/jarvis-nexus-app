/**
 * ThinkingStatus — Status de Pensamento do JARVIS (estilo Manus)
 * Exibe mensagens de ação em tempo real enquanto o Jarvis processa.
 */
import React, { useEffect, useRef } from 'react';
import { Cpu, GitBranch, FileCode, Zap, Search, Terminal, CheckCircle2 } from 'lucide-react';

const ICONS = {
  github: GitBranch,
  file: FileCode,
  vercel: Zap,
  search: Search,
  terminal: Terminal,
  check: CheckCircle2,
  default: Cpu,
};

function getIcon(msg) {
  const m = msg.toLowerCase();
  if (m.includes('github') || m.includes('reposit') || m.includes('branch') || m.includes('commit') || m.includes('pr') || m.includes('pull')) return ICONS.github;
  if (m.includes('arquivo') || m.includes('editando') || m.includes('lendo') || m.includes('file')) return ICONS.file;
  if (m.includes('vercel') || m.includes('deploy') || m.includes('log')) return ICONS.vercel;
  if (m.includes('pesquisando') || m.includes('analisando') || m.includes('buscando')) return ICONS.search;
  if (m.includes('teste') || m.includes('sandbox') || m.includes('npm') || m.includes('flutter') || m.includes('terminal')) return ICONS.terminal;
  if (m.includes('concluído') || m.includes('sucesso') || m.includes('pronto')) return ICONS.check;
  return ICONS.default;
}

export default function ThinkingStatus({ steps = [], isLoading }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  if (!isLoading && steps.length === 0) return null;

  const visible = steps.slice(-5); // show last 5 steps

  return (
    <div className="mx-4 mb-2 rounded-xl border border-cyan-800/25 bg-[#060d16]/80 overflow-hidden backdrop-blur-sm"
      style={{ boxShadow: '0 0 20px rgba(0,255,255,0.03)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-900/20">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
        <span className="text-[9px] font-mono text-cyan-500/60 tracking-widest uppercase">
          JARVIS — Processo de Pensamento
        </span>
        <div className="ml-auto">
          {isLoading && (
            <div className="w-3 h-3 border border-cyan-500/50 border-t-cyan-300 rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-3 py-2 space-y-1.5 max-h-28 overflow-y-auto">
        {visible.map((step, i) => {
          const Icon = getIcon(step.msg);
          const isLast = i === visible.length - 1;
          const isDone = step.done;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 transition-all duration-300 ${isLast && isLoading && !isDone ? 'animate-fade-in-up' : 'opacity-50'}`}
            >
              <Icon className={`w-3 h-3 shrink-0 ${isDone ? 'text-green-400/70' : isLast ? 'text-cyan-400' : 'text-cyan-700/40'}`} />
              <span className={`text-[10px] font-mono ${isDone ? 'text-green-400/60 line-through' : isLast ? 'text-cyan-300/80' : 'text-cyan-700/40'}`}>
                {step.msg}
              </span>
              {isDone && <span className="ml-auto text-[9px] font-mono text-green-500/50">✓</span>}
              {isLast && isLoading && !isDone && (
                <span className="ml-auto flex gap-0.5">
                  <span className="w-1 h-1 bg-cyan-400 rounded-full typing-dot-1" />
                  <span className="w-1 h-1 bg-cyan-400 rounded-full typing-dot-2" />
                  <span className="w-1 h-1 bg-cyan-400 rounded-full typing-dot-3" />
                </span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}