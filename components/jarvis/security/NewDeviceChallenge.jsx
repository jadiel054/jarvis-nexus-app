import React, { useState, useRef, useEffect } from 'react';
import { Shield, ShieldOff, KeyRound, AlertTriangle } from 'lucide-react';
import { trustDevice } from './deviceGuard';

const EMERGENCY_PIN_KEY = 'jarvis_emergency_pin';
const LOCKOUT_KEY = 'jarvis_pin_lockout';
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 4;

function getStoredPin() {
  return localStorage.getItem(EMERGENCY_PIN_KEY) || null;
}

function isLockedOut() {
  try {
    const lockout = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || 'null');
    if (!lockout) return false;
    if (Date.now() - lockout.timestamp < LOCKOUT_DURATION_MS) return true;
    localStorage.removeItem(LOCKOUT_KEY);
    return false;
  } catch { return false; }
}

function setLockout() {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ timestamp: Date.now() }));
}

function playAlertTone(confirmed = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (confirmed) {
      [440, 550, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } else {
      [220, 180, 220].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'square';
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.15);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.15);
      });
    }
  } catch {}
}

export default function NewDeviceChallenge({ deviceId, deviceLabel, ipInfo, onSuccess, onBlock }) {
  const [phase, setPhase] = useState('alert'); // alert | pin | confirmed | blocked
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [failCount, setFailCount] = useState(0);
  const pinRef0 = useRef(); const pinRef1 = useRef(); const pinRef2 = useRef();
  const pinRef3 = useRef(); const pinRef4 = useRef(); const pinRef5 = useRef();
  const pinRefs = [pinRef0, pinRef1, pinRef2, pinRef3, pinRef4, pinRef5];

  useEffect(() => { playAlertTone(false); }, []);

  const handlePinDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin]; next[i] = val; setPin(next);
    if (val && i < 5) pinRefs[i + 1].current?.focus();
    if (next.every(d => d !== '') && i === 5) verifyPin(next.join(''));
  };

  const handlePinKey = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs[i - 1].current?.focus();
  };

  const verifyPin = (entered) => {
    const storedPin = getStoredPin();
    if (!storedPin) {
      setPinError('Nenhum PIN configurado. Configure um PIN nas Configurações → Segurança.');
      return;
    }
    if (isLockedOut()) {
      setPhase('blocked');
      onBlock?.();
      return;
    }
    if (entered === storedPin) {
      confirmSuccess();
    } else {
      const nf = failCount + 1;
      setFailCount(nf);
      setPin(['', '', '', '', '', '']);
      pinRefs[0].current?.focus();
      if (nf >= MAX_ATTEMPTS) {
        playAlertTone(false);
        setLockout();
        setPhase('blocked');
        onBlock?.();
      } else {
        setPinError(`PIN inválido. ${MAX_ATTEMPTS - nf} tentativa(s) restante(s).`);
        playAlertTone(false);
      }
    }
  };

  const confirmSuccess = () => {
    trustDevice(deviceId);
    playAlertTone(true);
    setPhase('confirmed');
    setTimeout(() => onSuccess(), 1800);
  };

  // ── Alert phase ──
  if (phase === 'alert') {
    return (
      <Overlay orange>
        <div className="bg-[#0f0800] border-2 border-orange-500/60 rounded-2xl p-7 text-center"
          style={{ boxShadow: '0 0 60px rgba(251,146,60,0.2)' }}>
          <style>{`@keyframes pulse-orange { 0%,100%{box-shadow:0 0 30px rgba(251,146,60,0.15)} 50%{box-shadow:0 0 60px rgba(251,146,60,0.4)} }`}</style>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-orange-500/60 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)' }}>
            <AlertTriangle className="w-8 h-8 text-orange-400 animate-pulse" />
          </div>
          <h2 className="text-sm font-bold font-mono text-orange-300 tracking-widest mb-2">
            ⚠ PROTOCOLO DE SEGURANÇA ATIVADO
          </h2>
          <p className="text-xs font-mono text-orange-400/80 mb-1">Novo dispositivo detectado.</p>
          <p className="text-xs font-mono text-orange-300/60 mb-1">Identidade pendente de verificação.</p>
          <div className="mt-4 p-3 rounded-xl border border-orange-800/40 bg-orange-950/20 text-left space-y-1">
            <p className="text-[10px] font-mono text-orange-700/60">📱 Dispositivo: <span className="text-orange-400/80">{deviceLabel}</span></p>
            <p className="text-[10px] font-mono text-orange-700/60">🌐 IP: <span className="text-orange-400/80">{ipInfo?.ip}</span></p>
            <p className="text-[10px] font-mono text-orange-700/60">📍 Local: <span className="text-orange-400/80">{ipInfo?.city}, {ipInfo?.country}</span></p>
          </div>
          <button onClick={() => setPhase('pin')}
            className="mt-5 w-full py-3 rounded-xl font-mono text-sm font-bold tracking-wider transition-all"
            style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.2),rgba(239,68,68,0.2))', border: '1px solid rgba(251,146,60,0.5)', color: '#fdba74' }}>
            🔐 VERIFICAR COM PIN
          </button>
          <button onClick={onBlock}
            className="mt-2 w-full py-2 rounded-xl font-mono text-[10px] text-orange-900/50 hover:text-orange-700/60 transition-colors">
            Não sou eu — Bloquear acesso
          </button>
        </div>
      </Overlay>
    );
  }

  // ── PIN phase ──
  if (phase === 'pin') {
    return (
      <Overlay orange>
        <div className="bg-[#0f0800] border-2 border-orange-500/50 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(251,146,60,0.15)' }}>
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-orange-600/40 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)' }}>
            <KeyRound className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-sm font-bold font-mono text-orange-300 tracking-widest mb-1">VERIFICAÇÃO DE IDENTIDADE</h2>
          <p className="text-[10px] font-mono text-orange-700/50 mb-1">Código PIN de 6 dígitos</p>

          {/* Show default PIN hint for first access */}
          <div className="mb-5 p-2.5 rounded-lg border border-orange-700/30 bg-orange-950/30">
            <p className="text-[10px] font-mono text-orange-400/80">
              🔑 PIN temporário de primeiro acesso:
            </p>
            <p className="text-lg font-mono font-bold text-orange-300 tracking-[0.3em] mt-1">123456</p>
            <p className="text-[9px] font-mono text-orange-700/40 mt-1">Redefina após o login nas Configurações de Segurança</p>
          </div>

          <div className="flex justify-center gap-2 mb-4">
            {pin.map((d, i) => (
              <input key={i} ref={pinRefs[i]} type="password" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handlePinDigit(i, e.target.value)}
                onKeyDown={e => handlePinKey(i, e)}
                className="w-10 h-12 text-center text-lg font-mono font-bold rounded-lg border outline-none transition-all"
                style={{ background: '#050a0f', borderColor: d ? 'rgba(251,146,60,0.6)' : 'rgba(251,146,60,0.2)', color: '#fdba74', boxShadow: d ? '0 0 8px rgba(251,146,60,0.15)' : 'none' }}
                autoFocus={i === 0}
              />
            ))}
          </div>
          {pinError && <p className="text-[10px] font-mono text-red-400/80 mb-3">{pinError}</p>}
          <button onClick={() => setPhase('alert')}
            className="w-full py-2 rounded-xl font-mono text-[10px] border border-orange-900/30 text-orange-800/50 hover:text-orange-600/60 transition-all">
            Voltar
          </button>
        </div>
      </Overlay>
    );
  }

  // ── Confirmed ──
  if (phase === 'confirmed') {
    return (
      <Overlay>
        <div className="bg-[#050a0f] border-2 border-cyan-400/60 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(0,255,255,0.2)' }}>
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border-2 border-cyan-400 flex items-center justify-center animate-pulse-glow"
            style={{ background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, transparent 70%)' }}>
            <Shield className="w-8 h-8 text-cyan-300" />
          </div>
          <h2 className="text-sm font-bold font-mono text-cyan-300 tracking-widest mb-2">✅ IDENTIDADE CONFIRMADA</h2>
          <p className="text-xs font-mono text-cyan-200/90 mb-1">Acesso Total Liberado, Sr. Jadiel.</p>
          <p className="text-[10px] font-mono text-cyan-700/60">Dispositivo registrado como confiável.</p>
          <p className="text-[9px] font-mono text-cyan-800/40 mt-1">Todos os protocolos de segurança satisfeitos.</p>
        </div>
      </Overlay>
    );
  }

  // ── Blocked ──
  if (phase === 'blocked') {
    return (
      <Overlay orange>
        <div className="bg-[#0f0505] border-2 border-red-700/60 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(239,68,68,0.2)' }}>
          <ShieldOff className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-sm font-bold font-mono text-red-400 tracking-widest mb-2">⛔ ACESSO BLOQUEADO</h2>
          <p className="text-[10px] font-mono text-red-700/60">Número máximo de tentativas atingido.</p>
          <p className="text-[10px] font-mono text-red-800/40 mt-1">Incidente registrado em log de segurança.</p>
        </div>
      </Overlay>
    );
  }

  return null;
}

function Overlay({ children, orange = false }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className={`absolute inset-0 backdrop-blur-md ${orange ? 'bg-black/90' : 'bg-black/85'}`} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(${orange ? '#f97316' : '#00ffff'} 1px, transparent 1px), linear-gradient(90deg, ${orange ? '#f97316' : '#00ffff'} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">{children}</div>
    </div>
  );
}