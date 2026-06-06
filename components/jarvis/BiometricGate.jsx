import React, { useState, useCallback } from 'react';
import { Fingerprint, KeyRound, ShieldOff } from 'lucide-react';
import { HudOverlay } from '@/utils/hudElements';
import { usePinInput, PinInputGrid, getStoredPin } from '@/utils/pinInput';
import { attemptWebAuthn } from '@/utils/webauthn';

const SARCASTIC_DENIED = [
  "PIN incorreto. Isso é embaraçoso. Tente novamente.",
  "Não é esse o código. Stark Industries não aceita chutes.",
  "Acesso negado. A senha não é sua data de aniversário, esperamos.",
  "Código inválido. Uma tentativa registrada. Vá com calma.",
];

export default function BiometricGate({ onSuccess, onCancel }) {
  const [mode, setMode] = useState('pin'); // pin | pin_error | biometric_pending | blocked
  const [errorMsg, setErrorMsg] = useState('');
  const [failCount, setFailCount] = useState(0);

  const verifyPin = useCallback((entered) => {
    if (entered === getStoredPin()) {
      onSuccess();
    } else {
      const newFail = failCount + 1;
      setFailCount(newFail);
      pinInput.reset();
      if (newFail >= 5) {
        setMode('blocked');
      } else {
        const msg = SARCASTIC_DENIED[Math.floor(Math.random() * SARCASTIC_DENIED.length)];
        setErrorMsg(msg);
        setMode('pin_error');
      }
    }
  }, [failCount, onSuccess]);

  const pinInput = usePinInput({ length: 6, onComplete: verifyPin });

  const handleBiometric = async () => {
    setMode('biometric_pending');
    const result = await attemptWebAuthn();
    if (result.success) {
      onSuccess();
    } else {
      setMode('pin');
    }
  };

  // ── Blocked ──
  if (mode === 'blocked') {
    return (
      <HudOverlay>
        <div className="bg-[#0f0505] border border-red-800/50 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(255,0,0,0.08)' }}>
          <ShieldOff className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-sm font-bold font-mono text-red-400 tracking-widest mb-2">⚠ SISTEMA BLOQUEADO</h2>
          <p className="text-[10px] font-mono text-red-700/60">{failCount} tentativas inválidas registradas.</p>
          <button onClick={onCancel}
            className="mt-6 w-full py-2.5 rounded-xl font-mono text-xs border border-red-800/30 text-red-600/60 hover:border-red-600/50 hover:text-red-400 transition-all">
            Sair
          </button>
        </div>
      </HudOverlay>
    );
  }

  // ── Biometric pending ──
  if (mode === 'biometric_pending') {
    return (
      <HudOverlay>
        <div className="bg-[#080f1a] border border-cyan-800/40 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(0,255,255,0.06)' }}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-cyan-400 flex items-center justify-center animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 70%)' }}>
            <Fingerprint className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-base font-bold font-mono text-cyan-300 tracking-widest mb-1">AGUARDANDO BIOMETRIA</h2>
          <p className="text-[10px] font-mono text-cyan-700/50 mb-6">Use Face ID ou Touch ID no seu dispositivo...</p>
          <button onClick={() => setMode('pin')}
            className="w-full py-2.5 rounded-xl font-mono text-xs border border-cyan-900/30 text-cyan-700/50 hover:text-cyan-500/70 transition-all">
            🔑 Usar PIN de 6 Dígitos
          </button>
        </div>
      </HudOverlay>
    );
  }

  // ── PIN screen (primary) ──
  return (
    <HudOverlay>
      <div className="bg-[#080f1a] border border-cyan-800/40 rounded-2xl p-8 text-center"
        style={{ boxShadow: '0 0 60px rgba(0,255,255,0.06)' }}>

        <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-cyan-700/40 flex items-center justify-center"
          style={{ background: 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 70%)' }}>
          <KeyRound className="w-7 h-7 text-cyan-400" />
        </div>

        <h2 className="text-sm font-bold font-mono text-cyan-300 tracking-widest mb-1">CENTRAL DE COMANDO</h2>
        <p className="text-[10px] font-mono text-cyan-700/50 mb-1 tracking-wider">
          Digite seu PIN de 6 dígitos para acessar
        </p>
        <p className="text-[9px] font-mono text-cyan-800/40 mb-5">
          PIN padrão: <span className="text-cyan-700/60">123456</span> — altere nas Configurações de Segurança
        </p>

        <div className="mb-4">
          <PinInputGrid
            pin={pinInput.pin}
            setRef={pinInput.setRef}
            onDigit={pinInput.handleDigit}
            onKeyDown={pinInput.handleKeyDown}
          />
        </div>

        {mode === 'pin_error' && (
          <p className="text-[10px] font-mono text-red-400/80 mb-3 italic">"{errorMsg}"</p>
        )}

        <button onClick={handleBiometric}
          className="w-full py-2.5 rounded-xl font-mono text-xs border border-cyan-800/30 text-cyan-600/60 hover:text-cyan-400 hover:border-cyan-600/40 transition-all mb-2 flex items-center justify-center gap-2">
          <Fingerprint className="w-3.5 h-3.5" />
          Entrar com Biometria (Face ID / Touch ID)
        </button>

        <button onClick={onCancel}
          className="w-full py-2 font-mono text-[10px] text-cyan-900/40 hover:text-cyan-700/50 transition-colors">
          Cancelar
        </button>
      </div>
    </HudOverlay>
  );
}
