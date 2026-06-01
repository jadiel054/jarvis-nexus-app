import React, { useEffect, useState } from 'react';
import { ShieldOff, RefreshCw } from 'lucide-react';
import { revokeAllSessions } from '../components/jarvis/security/deviceGuard';

export default function SecurityBlock() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Check if this page was opened via the emergency block link
    const params = new URLSearchParams(window.location.search);
    if (params.get('jarvis_block') === '1') {
      revokeAllSessions();
      // Clear PIN so user must reconfigure
      localStorage.removeItem('jarvis_emergency_pin');
      setDone(true);
    }
  }, []);

  const goBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#050a0f] flex items-center justify-center p-6"
      style={{ backgroundImage: 'linear-gradient(#00ffff11 1px, transparent 1px), linear-gradient(90deg, #00ffff11 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      <div className="w-full max-w-sm">
        <div className={`rounded-2xl p-8 text-center border-2 ${done ? 'border-cyan-500/40 bg-[#080f1a]' : 'border-red-700/50 bg-[#0f0505]'}`}
          style={{ boxShadow: done ? '0 0 60px rgba(0,255,255,0.1)' : '0 0 60px rgba(239,68,68,0.15)' }}>

          <div className={`w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center border-2 ${done ? 'border-cyan-500/50' : 'border-red-600/50'}`}
            style={{ background: done ? 'radial-gradient(circle,rgba(0,255,255,0.1) 0%,transparent 70%)' : 'radial-gradient(circle,rgba(239,68,68,0.1) 0%,transparent 70%)' }}>
            <ShieldOff className={`w-8 h-8 ${done ? 'text-cyan-400' : 'text-red-400'}`} />
          </div>

          {done ? (
            <>
              <h1 className="text-base font-bold font-mono text-cyan-300 tracking-widest mb-2">CONTA PROTEGIDA</h1>
              <p className="text-xs font-mono text-cyan-600/70 mb-2">Todas as sessões foram encerradas.</p>
              <p className="text-xs font-mono text-cyan-700/50 mb-5">Redefina seu PIN ao fazer login novamente.</p>
              <button onClick={goBack}
                className="w-full py-3 rounded-xl font-mono text-sm tracking-wider transition-all flex items-center justify-center gap-2"
                style={{ background:'linear-gradient(135deg,rgba(0,255,255,0.1),rgba(0,128,255,0.1))', border:'1px solid rgba(0,255,255,0.3)', color:'#67e8f9' }}>
                <RefreshCw className="w-4 h-4" />
                Ir para o J.A.R.V.I.S.
              </button>
            </>
          ) : (
            <>
              <h1 className="text-base font-bold font-mono text-red-400 tracking-widest mb-2">⚠ ACESSO INVÁLIDO</h1>
              <p className="text-xs font-mono text-red-600/70 mb-5">Link de bloqueio inválido ou expirado.</p>
              <button onClick={goBack}
                className="w-full py-2 rounded-xl font-mono text-xs border border-red-800/30 text-red-700/50 hover:text-red-500 transition-all">
                Voltar
              </button>
            </>
          )}

          <p className="text-[8px] font-mono text-cyan-900/30 mt-6">J.A.R.V.I.S. SECURITY — STARK LEGACY v5.0</p>
        </div>
      </div>
    </div>
  );
}