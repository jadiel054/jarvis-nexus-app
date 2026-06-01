import React, { useEffect } from 'react';
import { Zap, Shield } from 'lucide-react';

// Soft tech beep using Web Audio API
function playBeep(freq = 880, type = 'square', duration = 0.12) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function playCombatBeep() {
  playBeep(440, 'sawtooth', 0.08);
  setTimeout(() => playBeep(660, 'sawtooth', 0.1), 100);
}

export function playFriendlyBeep() {
  playBeep(880, 'sine', 0.1);
  setTimeout(() => playBeep(1100, 'sine', 0.08), 120);
}

export default function CombatModeBar({ combatMode, onToggle }) {
  useEffect(() => {
    if (combatMode) playCombatBeep();
    else playFriendlyBeep();
  }, [combatMode]);

  return (
    <div className={`flex items-center justify-between px-4 py-1.5 border-b transition-all duration-500 ${
      combatMode
        ? 'bg-orange-950/30 border-orange-700/40'
        : 'bg-cyan-950/10 border-cyan-900/20'
    }`}>
      <div className="flex items-center gap-2">
        {combatMode
          ? <Zap className="w-3 h-3 text-orange-400 animate-pulse" />
          : <Shield className="w-3 h-3 text-cyan-500/60" />}
        <span className={`text-[9px] font-mono tracking-widest ${combatMode ? 'text-orange-400' : 'text-cyan-700/50'}`}>
          {combatMode ? 'PROTOCOLO DE COMBATE ATIVO // MODO TÉCNICO-DIRETO' : 'PROTOCOLO AMIGÁVEL // MODO PADRÃO'}
        </span>
      </div>
      <button onClick={onToggle}
        className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all ${
          combatMode
            ? 'border-orange-700/50 text-orange-500 hover:bg-orange-500/10'
            : 'border-cyan-800/30 text-cyan-700/50 hover:border-cyan-600/50 hover:text-cyan-500'
        }`}>
        {combatMode ? '🔴 DESATIVAR' : '⚡ COMBATE'}
      </button>
    </div>
  );
}