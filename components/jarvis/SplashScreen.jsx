import React, { useState, useEffect } from 'react';
import { Cpu, Shield, Wifi, Zap, Database, Eye } from 'lucide-react';
import { CornerBrackets, ScanLine, GridBackground } from '@/utils/hudElements';

const QUICK_COMMANDS = [
  { icon: '🌤️', label: 'Clima', cmd: 'Como está o clima em São Paulo?' },
  { icon: '🧮', label: 'Calcular', cmd: 'Calcule 245 * 18' },
  { icon: '🗺️', label: 'Rota', cmd: 'Distância de São Paulo para Rio de Janeiro' },
  { icon: '💱', label: 'Moeda', cmd: '500 reais em dólar' },
  { icon: '😄', label: 'Piada', cmd: 'Conta uma piada' },
  { icon: '♈', label: 'Signo', cmd: 'Qual é meu signo?' },
];

const STATUS_NODES = [
  { icon: Cpu, label: 'Neural Core', status: 'ONLINE' },
  { icon: Shield, label: 'Security', status: 'ARMED' },
  { icon: Wifi, label: 'Network', status: 'ACTIVE' },
  { icon: Database, label: 'Memory', status: 'LOADED' },
  { icon: Eye, label: 'Perception', status: 'ONLINE' },
  { icon: Zap, label: 'Power', status: '100%' },
];

export default function SplashScreen({ onStart, onQuickCommand }) {
  const [phase, setPhase] = useState(0);
  const [bootLines, setBootLines] = useState([]);
  const [statusIndex, setStatusIndex] = useState(0);
  const [glitchActive, setGlitchActive] = useState(false);

  const lines = [
    'Inicializando núcleo quântico...',
    'Carregando módulos de IA avançada...',
    'Verificando protocolos de segurança...',
    'Sincronizando memória persistente...',
    'Calibrando sistemas de percepção...',
    'Sistema J.A.R.V.I.S. pronto.',
  ];

  useEffect(() => {
    lines.forEach((line, i) => {
      setTimeout(() => {
        setBootLines(prev => [...prev, line]);
        if (i === lines.length - 1) {
          setTimeout(() => setPhase(1), 600);
        }
      }, (i + 1) * 500);
    });

    // Glitch effect
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 150);
    }, 4000);

    return () => clearInterval(glitchInterval);
  }, []);

  useEffect(() => {
    if (phase === 1) {
      const interval = setInterval(() => {
        setStatusIndex(i => {
          if (i < STATUS_NODES.length) return i + 1;
          clearInterval(interval);
          // Auto-redirect after all status nodes appear + 1.5s
          setTimeout(() => onStart(null), 1500);
          return i;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050a0f] overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <GridBackground color="#00ffff" opacity={0.03} size={50} />

        {/* Rotating rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {[600, 480, 360, 240].map((size, i) => (
            <div key={i} className="absolute rounded-full border border-cyan-500/10"
              style={{
                width: size, height: size,
                top: -size / 2, left: -size / 2,
                animation: `hud-rotate ${10 + i * 8}s linear infinite ${i % 2 ? 'reverse' : ''}`,
                borderStyle: i % 2 ? 'dashed' : 'solid',
              }}
            />
          ))}
        </div>

        <CornerBrackets size={14} offset={6} color="cyan-500/25" borderWidth="border-2" />

        <ScanLine />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="relative flex items-center justify-center">
          <div className={`relative w-36 h-36 rounded-full overflow-hidden border-2 border-cyan-400/40 animate-pulse-glow transition-all ${glitchActive ? 'translate-x-0.5 brightness-110' : ''}`}
            style={{ boxShadow: '0 0 30px rgba(0,255,255,0.15), 0 0 60px rgba(0,128,255,0.1)' }}>
            <img
              src="https://media.base44.com/images/public/69af89b738ecc48659715046/1ad6a36fb_1775009323063.png"
              alt="JARVIS"
              className="w-full h-full object-cover object-top"
            />
            {/* Cyan overlay tint */}
            <div className="absolute inset-0 bg-cyan-400/5 mix-blend-screen" />
          </div>
          {/* Orbiting dot */}
          <div className="absolute w-40 h-40" style={{ animation: 'hud-rotate 3s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400/80" />
          </div>
          {/* Outer ring */}
          <div className="absolute w-44 h-44 rounded-full border border-cyan-500/20" style={{ animation: 'hud-rotate 8s linear infinite reverse' }} />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className={`text-4xl sm:text-5xl font-bold text-cyan-300 tracking-[0.3em] font-mono transition-all ${glitchActive ? 'text-teal-300' : ''}`}>
            J.A.R.V.I.S.
          </h1>
          <p className="text-[11px] font-mono text-cyan-600/50 mt-2 tracking-widest">
            JUST A RATHER VERY INTELLIGENT SYSTEM — v4.0
          </p>
        </div>

        {/* Boot sequence */}
        <div className="w-full bg-[#0a1520]/60 border border-cyan-900/30 rounded-xl p-4 min-h-[160px]">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-900/30">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-mono text-cyan-600/50 tracking-widest">BOOT SEQUENCE // TERMINAL</span>
          </div>
          <div className="space-y-1.5">
            {bootLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 animate-fade-in-up">
                <span className="text-cyan-500/40 text-[10px]">▸</span>
                <span className={`text-xs font-mono ${i === bootLines.length - 1 && phase === 1 ? 'text-green-400' : 'text-cyan-600/60'}`}>
                  {line}
                </span>
                {i === bootLines.length - 1 && phase === 1 && (
                  <span className="text-[10px] text-green-400 ml-auto">✓ OK</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System status grid */}
        {phase === 1 && (
          <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-2 animate-fade-in-up">
            {STATUS_NODES.map((node, i) => {
              const Icon = node.icon;
              const active = i < statusIndex;
              return (
                <div key={i} className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all duration-500
                  ${active ? 'border-cyan-700/50 bg-cyan-500/5' : 'border-cyan-900/20 opacity-30'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-cyan-700'}`} />
                  <span className="text-[8px] font-mono text-cyan-600/60 text-center leading-tight">{node.label}</span>
                  <span className={`text-[8px] font-mono ${active ? 'text-green-400' : 'text-cyan-800'}`}>{node.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-redirect indicator */}
        {phase === 1 && statusIndex >= STATUS_NODES.length && (
          <div className="animate-fade-in-up flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/70 tracking-widest">REDIRECIONANDO...</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-[9px] font-mono text-cyan-800/40">
          <span>STARK INDUSTRIES</span><span>•</span>
          <span>NEURAL CORE ONLINE</span><span>•</span>
          <span>QUANTUM SECURE</span>
        </div>
      </div>
    </div>
  );
}