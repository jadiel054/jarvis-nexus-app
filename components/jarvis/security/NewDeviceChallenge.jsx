import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldOff, KeyRound, AlertTriangle } from 'lucide-react';
import { trustDevice } from './deviceGuard';
import { HudOverlay } from '@/utils/hudElements';
import { usePinInput, PinInputGrid, getStoredPin } from '@/utils/pinInput';
import { playToneSequence } from '@/utils/audioFeedback';

function playAlertTone(confirmed = false) {
  if (confirmed) {
    playToneSequence([
      { freq: 440, type: 'sine', delay: 0, duration: 0.3, volume: 0.18 },
      { freq: 550, type: 'sine', delay: 0.12, duration: 0.3, volume: 0.18 },
      { freq: 660, type: 'sine', delay: 0.24, duration: 0.3, volume: 0.18 },
    ]);
  } else {
    playToneSequence([
      { freq: 220, type: 'square', delay: 0, duration: 0.15, volume: 0.08 },
      { freq: 180, type: 'square', delay: 0.18, duration: 0.15, volume: 0.08 },
      { freq: 220, type: 'square', delay: 0.36, duration: 0.15, volume: 0.08 },
    ]);
  }
}

export default function NewDeviceChallenge({ deviceId, deviceLabel, ipInfo, onSuccess, onBlock }) {
  const [phase, setPhase] = useState('alert'); // alert | pin | confirmed | blocked
  const [pinError, setPinError] = useState('');
  const [failCount, setFailCount] = useState(0);

  useEffect(() => { playAlertTone(false); }, []);

  const confirmSuccess = useCallback(() => {
    trustDevice(deviceId);
    playAlertTone(true);
    setPhase('confirmed');
    setTimeout(() => onSuccess(), 1800);
  }, [deviceId, onSuccess]);

  const verifyPin = useCallback((entered) => {
    if (entered === getStoredPin()) {
      confirmSuccess();
    } else {
      const nf = failCount + 1;
      setFailCount(nf);
      pinInput.reset();
      if (nf >= 4) {
        playAlertTone(false);
        setPhase('blocked');
        onBlock?.();
      } else {
        setPinError(`PIN inválido. ${4 - nf} tentativa(s) restante(s).`);
        playAlertTone(false);
      }
    }
  }, [failCount, confirmSuccess, onBlock]);

  const pinInput = usePinInput({ length: 6, onComplete: verifyPin });

  // ── Alert phase ──
  if (phase === 'alert') {
    return (
      <HudOverlay orange zIndex={70}>
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
      </HudOverlay>
    );
  }

  // ── PIN phase ──
  if (phase === 'pin') {
    return (
      <HudOverlay orange zIndex={70}>
        <div className="bg-[#0f0800] border-2 border-orange-500/50 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(251,146,60,0.15)' }}>
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-orange-600/40 flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)' }}>
            <KeyRound className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-sm font-bold font-mono text-orange-300 tracking-widest mb-1">VERIFICAÇÃO DE IDENTIDADE</h2>
          <p className="text-[10px] font-mono text-orange-700/50 mb-1">Código PIN de 6 dígitos</p>

          <div className="mb-5 p-2.5 rounded-lg border border-orange-700/30 bg-orange-950/30">
            <p className="text-[10px] font-mono text-orange-400/80">
              🔑 PIN temporário de primeiro acesso:
            </p>
            <p className="text-lg font-mono font-bold text-orange-300 tracking-[0.3em] mt-1">123456</p>
            <p className="text-[9px] font-mono text-orange-700/40 mt-1">Redefina após o login nas Configurações de Segurança</p>
          </div>

          <div className="mb-4">
            <PinInputGrid
              pin={pinInput.pin}
              setRef={pinInput.setRef}
              onDigit={pinInput.handleDigit}
              onKeyDown={pinInput.handleKeyDown}
              accentColor="orange"
            />
          </div>
          {pinError && <p className="text-[10px] font-mono text-red-400/80 mb-3">{pinError}</p>}
          <button onClick={() => setPhase('alert')}
            className="w-full py-2 rounded-xl font-mono text-[10px] border border-orange-900/30 text-orange-800/50 hover:text-orange-600/60 transition-all">
            Voltar
          </button>
        </div>
      </HudOverlay>
    );
  }

  // ── Confirmed ──
  if (phase === 'confirmed') {
    return (
      <HudOverlay zIndex={70}>
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
      </HudOverlay>
    );
  }

  // ── Blocked ──
  if (phase === 'blocked') {
    return (
      <HudOverlay orange zIndex={70}>
        <div className="bg-[#0f0505] border-2 border-red-700/60 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 60px rgba(239,68,68,0.2)' }}>
          <ShieldOff className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-sm font-bold font-mono text-red-400 tracking-widest mb-2">⛔ ACESSO BLOQUEADO</h2>
          <p className="text-[10px] font-mono text-red-700/60">Número máximo de tentativas atingido.</p>
          <p className="text-[10px] font-mono text-red-800/40 mt-1">Incidente registrado em log de segurança.</p>
        </div>
      </HudOverlay>
    );
  }

  return null;
}
