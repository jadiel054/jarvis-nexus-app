import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { GridBackground, ScanLine } from '@/utils/hudElements';

export default function LoginScreen({ onLoggedIn }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    setLoading(true);
    base44.auth.redirectToLogin();
  };

  return (
    <div className="h-screen bg-[#050a0f] flex items-center justify-center relative overflow-hidden">
      <GridBackground color="#00ffff" opacity={0.05} />
      
      {/* Animated rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-10">
        <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-hud-rotate" />
        <div className="absolute inset-8 rounded-full border border-cyan-600/20" style={{ animation: 'hud-rotate 30s linear infinite reverse' }} />
        <div className="absolute inset-16 rounded-full border border-cyan-800/20 animate-hud-rotate" style={{ animationDuration: '15s' }} />
      </div>

      <ScanLine />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-cyan-500/40 bg-cyan-500/5 mb-4 relative">
            <span className="text-3xl font-bold font-mono text-cyan-400">J</span>
            <div className="absolute inset-0 rounded-full animate-pulse-glow" />
          </div>
          <h1 className="text-3xl font-bold font-mono text-cyan-300 tracking-widest">J.A.R.V.I.S.</h1>
          <p className="text-[11px] font-mono text-cyan-600/60 mt-1 tracking-widest">JUST A RATHER VERY INTELLIGENT SYSTEM</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-px w-12 bg-cyan-800/40" />
            <span className="text-[10px] font-mono text-cyan-700/50">SECURE ACCESS PORTAL</span>
            <div className="h-px w-12 bg-cyan-800/40" />
          </div>
        </div>

        {/* Login card */}
        <div className="bg-[#0a1520]/80 backdrop-blur-md border border-cyan-800/30 rounded-2xl p-6 space-y-4 hud-bracket">
          <div className="text-center mb-2">
            <p className="text-xs font-mono text-cyan-500/60">AUTENTICAÇÃO NECESSÁRIA</p>
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
              bg-white/5 border border-cyan-700/30 hover:border-cyan-500/50 hover:bg-cyan-500/10
              transition-all duration-300 group disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span className="text-sm font-mono text-cyan-200/80 group-hover:text-cyan-100">
              {loading ? 'CONECTANDO...' : 'Entrar com Google'}
            </span>
          </button>

          {/* Email option */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
              bg-cyan-600/10 border border-cyan-600/30 hover:border-cyan-400/50 hover:bg-cyan-600/20
              transition-all duration-300 disabled:opacity-50"
          >
            <span className="text-sm font-mono text-cyan-300/80">Entrar com Email</span>
          </button>

          <p className="text-center text-[10px] font-mono text-cyan-700/40 pt-1">
            CONEXÃO CRIPTOGRAFADA • CANAL SEGURO
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-cyan-800/40 mt-6">
          STARK INDUSTRIES © {new Date().getFullYear()} // CLASSIFIED
        </p>
      </div>
    </div>
  );
}