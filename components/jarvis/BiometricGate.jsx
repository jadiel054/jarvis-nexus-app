import React, { useState, useRef } from 'react';
import { Shield, Fingerprint, KeyRound, ShieldOff } from 'lucide-react';

const EMERGENCY_PIN_KEY = 'jarvis_emergency_pin';
const DEFAULT_PIN = '123456'; // PIN padrão de 6 dígitos

function getStoredPin() {
  return localStorage.getItem(EMERGENCY_PIN_KEY) || DEFAULT_PIN;
}

const SARCASTIC_DENIED = [
  "PIN incorreto. Isso é embaraçoso. Tente novamente.",
  "Não é esse o código. Stark Industries não aceita chutes.",
  "Acesso negado. A senha não é sua data de aniversário, esperamos.",
  "Código inválido. Uma tentativa registrada. Vá com calma.",
];

export default function BiometricGate({ onSuccess, onCancel }) {
  // Start directly on PIN screen — PIN is primary, biometric is optional
  const [mode, setMode] = useState('pin'); // pin | pin_error | biometric_pending | blocked
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [failCount, setFailCount] = useState(0);
  const pinRef0 = useRef(); const pinRef1 = useRef(); const pinRef2 = useRef();
  const pinRef3 = useRef(); const pinRef4 = useRef(); const pinRef5 = useRef();
  const pinRefs = [pinRef0, pinRef1, pinRef2, pinRef3, pinRef4, pinRef5];

  // ── WebAuthn attempt ────────────────────────────────────────────
  const attemptBiometric = async () => {
    setMode('biometric_pending');
    if (!window.PublicKeyCredential) { setMode('pin'); return; }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) { setMode('pin'); return; }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      await navigator.credentials.get({
        publicKey: { challenge, timeout: 30000, userVerification: 'required',
          rpId: window.location.hostname || 'localhost', allowCredentials: [] },
      });
      onSuccess();
    } catch (e) {
      console.warn('[BiometricGate] Biometric auth failed:', e.message);
      setMode('pin');
    }
  };

  // ── PIN logic ───────────────────────────────────────────────────
  const handlePinDigit = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin];
    next[idx] = val;
    setPin(next);
    if (val && idx < 5) pinRefs[idx + 1].current?.focus();
    if (next.every(d => d !== '') && idx === 5) verifyPin(next.join(''));
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
  };

  const verifyPin = (entered) => {
    if (entered === getStoredPin()) {
      onSuccess();
    } else {
      const newFail = failCount + 1;
      setFailCount(newFail);
      setPin(['', '', '', '', '', '']);
      pinRefs[0].current?.focus();
      if (newFail >= 5) {
        setMode('blocked');
      } else {
        const msg = SARCASTIC_DENIED[Math.floor(Math.random() * SARCASTIC_DENIED.length)];
        setErrorMsg(msg);
        setMode('pin_error');
      }
    }
  };

  // ── Blocked ──
  if (mode === 'blocked') {
    return (
      <Overlay>
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
      </Overlay>
    );
  }

  // ── Biometric pending ──
  if (mode === 'biometric_pending') {
    return (
      <Overlay>
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
      </Overlay>
    );
  }

  // ── PIN screen (primary) ──
  return (
    <Overlay>
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

        {/* PIN inputs */}
        <div className="flex justify-center gap-2 mb-4">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={pinRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handlePinDigit(i, e.target.value)}
              onKeyDown={e => handlePinKeyDown(i, e)}
              className="w-10 h-12 text-center text-xl font-mono font-bold rounded-xl border transition-all outline-none"
              style={{
                background: '#050a0f',
                borderColor: digit ? 'rgba(0,255,255,0.5)' : 'rgba(0,255,255,0.15)',
                color: '#67e8f9',
                boxShadow: digit ? '0 0 10px rgba(0,255,255,0.1)' : 'none',
              }}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {mode === 'pin_error' && (
          <p className="text-[10px] font-mono text-red-400/80 mb-3 italic">"{errorMsg}"</p>
        )}

        {/* Biometric as secondary option */}
        <button onClick={attemptBiometric}
          className="w-full py-2.5 rounded-xl font-mono text-xs border border-cyan-800/30 text-cyan-600/60 hover:text-cyan-400 hover:border-cyan-600/40 transition-all mb-2 flex items-center justify-center gap-2">
          <Fingerprint className="w-3.5 h-3.5" />
          Entrar com Biometria (Face ID / Touch ID)
        </button>

        <button onClick={onCancel}
          className="w-full py-2 font-mono text-[10px] text-cyan-900/40 hover:text-cyan-700/50 transition-colors">
          Cancelar
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">{children}</div>
    </div>
  );
}