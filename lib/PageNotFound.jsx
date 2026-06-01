import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageNotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#050a0f] text-center px-6">
      <div className="w-20 h-20 rounded-full border-2 border-cyan-500/30 flex items-center justify-center mb-6 animate-pulse">
        <span className="text-3xl font-bold text-cyan-400 font-mono">?</span>
      </div>
      <h1 className="text-4xl font-bold text-cyan-300 font-mono tracking-widest mb-3">404</h1>
      <p className="text-cyan-600/60 font-mono text-sm mb-8">
        PROTOCOLO NÃO ENCONTRADO // ROTA INVÁLIDA
      </p>
      <Link
        to={createPageUrl('Home')}
        className="px-6 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 
          text-cyan-300 font-mono text-sm tracking-wider transition-all duration-300"
      >
        ▶ RETORNAR À BASE
      </Link>
    </div>
  );
}