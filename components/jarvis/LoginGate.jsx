import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CornerBrackets } from '@/utils/hudElements';

export default function LoginGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    // Loading
    return (
      <div className="h-screen flex items-center justify-center bg-[#050a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="text-[11px] font-mono text-cyan-600/50 tracking-widest">AUTENTICANDO...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050a0f] p-6 relative overflow-hidden">
        <CornerBrackets size={8} offset={4} color="cyan-500/20" />

        <div className="w-full max-w-sm text-center space-y-8">
          {/* Logo */}
          <div className="space-y-3">
            <div className="w-20 h-20 mx-auto rounded-full border-2 border-cyan-500/30 flex items-center justify-center relative">
              <div className="absolute inset-2 rounded-full border border-dashed border-cyan-700/30 animate-hud-rotate" />
              <span className="text-2xl font-bold font-mono text-cyan-400 relative z-10">J</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono text-cyan-300 tracking-widest">J.A.R.V.I.S.</h1>
              <p className="text-[10px] font-mono text-cyan-600/50 mt-1 tracking-wider">
                JUST A RATHER VERY INTELLIGENT SYSTEM
              </p>
            </div>
          </div>

          {/* Auth info */}
          <div className="bg-[#0a1520] border border-cyan-800/20 rounded-2xl p-6 space-y-4 text-left">
            <p className="text-xs font-mono text-cyan-400/70 text-center">
              Acesso restrito. Faça login ou crie sua conta para continuar.
            </p>
            <div className="space-y-2 text-[11px] font-mono text-cyan-600/50">
              <div className="flex items-center gap-2">
                <span className="text-cyan-500">▸</span> Configurações salvas na nuvem
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cyan-500">▸</span> Histórico personalizado
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cyan-500">▸</span> Seu JARVIS exclusivo
              </div>
            </div>
          </div>

          {/* Login button */}
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="w-full py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20
              text-cyan-300 font-mono text-sm tracking-wider transition-all duration-300 animate-pulse-glow"
          >
            ▶ INICIAR SESSÃO / CRIAR CONTA
          </button>

          <p className="text-[10px] font-mono text-cyan-700/30">
            PROTOCOLO DE AUTENTICAÇÃO SEGURA
          </p>
        </div>
      </div>
    );
  }

  return children;
}