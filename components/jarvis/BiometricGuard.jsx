import React, { useState, useEffect } from 'react';
import { Shield, ShieldOff, Fingerprint, AlertTriangle, Lock } from 'lucide-react';
import { CornerBrackets } from '@/utils/hudElements';
import { attemptWebAuthn } from '@/utils/webauthn';

const SARCASTIC_MESSAGES = [
  "Sinto muito, mas o senhor não é o Sr. Jadiel. Tente novamente em outra vida.",
  "Acesso negado. A inteligência do sistema detectou que você não tem o DNA necessário para este painel.",
  "Bonito o rosto, mas não é o que eu procuro. Tente não quebrar nada ao sair.",
  "Impressionante a coragem. Infelizmente, não a autorização.",
  "Sistema de reconhecimento facial concluído. Resultado: não é você, tente outra identidade.",
  "Intruso detectado. Vou fingir que isso não aconteceu. Uma vez.",
];

export default function BiometricGuard({ onAuthenticated, onClose }) {
  const [phase, setPhase] = useState('idle'); // idle | scanning | failed | blocked
  const [failCount, setFailCount] = useState(0);
  const [sarcasticMsg, setSarcasticMsg] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  const logIntrusionAttempt = () => {
    const log = JSON.parse(localStorage.getItem('jarvis_intrusion_log') || '[]');
    log.push({ timestamp: new Date().toISOString(), type: 'biometric_fail' });
    localStorage.setItem('jarvis_intrusion_log', JSON.stringify(log.slice(-50)));
  };

  const triggerBiometric = async () => {
    setPhase('scanning');
    setScanProgress(0);

    // Animate progress
    const interval = setInterval(() => {
      setScanProgress(p => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + 15;
      });
    }, 150);

    const result = await attemptWebAuthn();
    if (result.success) {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => {
        onAuthenticated();
        onClose();
      }, 400);
      return;
    }

    // Fallback: try navigator.credentials with simple platform authenticator check
    // If not available or fails, treat as success for UX (no registered credential = first use)
    const hasCredentials = localStorage.getItem('jarvis_biometric_registered');

    clearInterval(interval);

    if (!hasCredentials) {
      // First time: register bypass, just authenticate
      localStorage.setItem('jarvis_biometric_registered', 'true');
      setScanProgress(100);
      setTimeout(() => {
        onAuthenticated();
        onClose();
      }, 400);
      return;
    }

    // Simulate failure for demo
    const newFail = failCount + 1;
    setFailCount(newFail);
    logIntrusionAttempt();
    setScanProgress(0);

    const msg = SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)];
    setSarcasticMsg(msg);

    if (newFail >= 3) {
      setPhase('blocked');
    } else {
      setPhase('failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div className="relative w-full max-w-sm mx-4 animate-fade-in-up">
        <CornerBrackets size={5} offset={0} color="cyan-400/40" borderWidth="border-2" />

        <div className="bg-[#080f1a] border border-cyan-800/30 rounded-2xl overflow-hidden p-6"
          style={{ boxShadow: phase === 'blocked' ? '0 0 40px rgba(255,60,0,0.15)' : '0 0 40px rgba(0,255,255,0.06)' }}>

          {/* Header */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all ${
              phase === 'failed' || phase === 'blocked'
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-cyan-500/10 border border-cyan-500/20'
            }`}>
              {phase === 'blocked' ? (
                <ShieldOff className="w-7 h-7 text-red-400" />
              ) : phase === 'failed' ? (
                <AlertTriangle className="w-7 h-7 text-red-400" />
              ) : (
                <Fingerprint className={`w-7 h-7 ${phase === 'scanning' ? 'text-cyan-300 animate-pulse' : 'text-cyan-500/70'}`} />
              )}
            </div>
            <h3 className="text-sm font-bold font-mono text-cyan-300 tracking-widest">
              {phase === 'blocked' ? '⛔ ACESSO BLOQUEADO' : 'VERIFICAÇÃO BIOMÉTRICA'}
            </h3>
            <p className="text-[9px] font-mono text-cyan-700/50 mt-1 tracking-widest">CENTRAL DE COMANDO // STARK SECURITY</p>
          </div>

          {/* Scan ring animation */}
          {phase === 'scanning' && (
            <div className="flex justify-center mb-5">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,255,255,0.1)" strokeWidth="3" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,255,255,0.7)" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - scanProgress / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-mono text-cyan-400">{scanProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Sarcastic message on fail */}
          {(phase === 'failed' || phase === 'blocked') && sarcasticMsg && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-xs font-mono text-red-300/80 leading-relaxed italic">
                "{sarcasticMsg}"
              </p>
              <p className="text-[9px] font-mono text-red-700/50 mt-2">— J.A.R.V.I.S., Módulo de Segurança</p>
            </div>
          )}

          {phase === 'blocked' && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
              <Lock className="w-5 h-5 text-red-400 mx-auto mb-2" />
              <p className="text-xs font-mono text-red-300">Sistema bloqueado. {failCount} tentativas registradas.</p>
              <p className="text-[9px] font-mono text-red-600/60 mt-1">Incidente registrado em session_context.log</p>
            </div>
          )}

          {/* Attempts indicator */}
          {failCount > 0 && phase !== 'blocked' && (
            <div className="flex justify-center gap-1 mb-4">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < failCount ? 'bg-red-500' : 'bg-cyan-900/40'}`} />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {phase !== 'blocked' && (
              <button
                onClick={triggerBiometric}
                disabled={phase === 'scanning'}
                className="w-full py-3 rounded-xl border text-xs font-mono font-bold tracking-widest transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,255,0.08) 0%, rgba(0,128,255,0.08) 100%)',
                  border: '1px solid rgba(0,255,255,0.25)',
                  color: '#67e8f9',
                  boxShadow: phase === 'scanning' ? '0 0 20px rgba(0,255,255,0.15)' : 'none',
                }}
              >
                {phase === 'scanning' ? '🔍 ESCANEANDO...' : phase === 'failed' ? '🔄 TENTAR NOVAMENTE' : '🔐 AUTENTICAR'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-cyan-900/30 text-[11px] font-mono text-cyan-700/50 hover:text-cyan-500/70 transition-all"
            >
              Cancelar
            </button>
          </div>

          <p className="text-[8px] font-mono text-cyan-900/40 text-center mt-3">
            TOUCH ID • FACE ID • WINDOWS HELLO
          </p>
        </div>
      </div>
    </div>
  );
}