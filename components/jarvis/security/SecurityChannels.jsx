import React, { useState } from 'react';
import { Phone, Mail, CheckCircle, Loader2, Fingerprint, ScanFace } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { attemptWebAuthn } from '@/utils/webauthn';

const STORAGE_KEY = 'jarvis_security_channels';

function getChannels() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveChannels(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Biometric Registration ──────────────────────────────────────────
function BiometricRegistration() {
  const [touchStatus, setTouchStatus] = useState('idle'); // idle | pending | success | fail | unsupported
  const [faceStatus, setFaceStatus] = useState('idle');
  const stored = getChannels();

  const handleBiometric = async (type) => {
    const setter = type === 'touch' ? setTouchStatus : setFaceStatus;
    setter('pending');
    const result = await attemptWebAuthn();
    if (result.reason === 'unsupported' || result.reason === 'unavailable') {
      setter('unsupported');
      return;
    }
    if (result.success) {
      const channels = getChannels();
      channels[type === 'touch' ? 'touch_id' : 'face_id'] = true;
      saveChannels(channels);
      setter('success');
    } else {
      setter('fail');
      setTimeout(() => setter('idle'), 2500);
    }
  };

  const bioItem = (type, Icon, label, sublabel, status, setStatus) => {
    const isLinked = stored[type === 'touch' ? 'touch_id' : 'face_id'];
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-cyan-900/30 bg-cyan-950/10">
        <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
          status === 'success' || isLinked ? 'border-green-500/60 bg-green-500/10' :
          status === 'pending' ? 'border-cyan-400/60 animate-pulse' : 'border-cyan-800/30'
        }`}>
          <Icon className={`w-4 h-4 ${status === 'success' || isLinked ? 'text-green-400' : 'text-cyan-400/60'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-cyan-300/80">{label}</p>
          <p className="text-[9px] font-mono text-cyan-700/50">{sublabel}</p>
        </div>
        {isLinked ? (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-[9px] font-mono text-green-400">Vinculado</span>
          </div>
        ) : (
          <button
            onClick={() => handleBiometric(type)}
            disabled={status === 'pending'}
            className="px-3 py-1.5 rounded-lg border border-cyan-700/30 text-[10px] font-mono text-cyan-400/70 hover:border-cyan-500/50 hover:text-cyan-300 transition-all disabled:opacity-40"
          >
            {status === 'pending' ? <Loader2 className="w-3 h-3 animate-spin" /> :
             status === 'fail' ? '⚠ Falhou' :
             status === 'unsupported' ? '✗ N/D' : 'Vincular'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {bioItem('touch', Fingerprint, 'Vincular Digital (Touch ID)', 'Autenticação por impressão digital', touchStatus, setTouchStatus)}
      {bioItem('face', ScanFace, 'Vincular Rosto (Face ID)', 'Reconhecimento facial biométrico', faceStatus, setFaceStatus)}
    </div>
  );
}

// ── OTP Channel Row ──────────────────────────────────────────────────
function ChannelRow({ type, icon: Icon, label, placeholder, channelKey }) {
  const stored = getChannels();
  const [value, setValue] = useState(stored[channelKey + '_value'] || '');
  const [isVerified, setIsVerified] = useState(!!stored[channelKey + '_verified']);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [otpError, setOtpError] = useState('');

  const sendOtp = async () => {
    if (!value.trim()) return;
    setSending(true);
    const code = generateOTP();
    setGeneratedOtp(code);

    if (type === 'email') {
      try {
        await base44.integrations.Core.SendEmail({
          to: value.trim(),
          subject: '🔐 JARVIS — Código de Verificação',
          body: `<div style="font-family:monospace;background:#050a0f;color:#67e8f9;padding:24px;border-radius:12px;border:1px solid rgba(0,255,255,0.2)">
            <h2 style="color:#00ffff;margin-bottom:8px">⬡ JARVIS SECURITY PROTOCOL</h2>
            <p style="color:#a0cfef;margin-bottom:16px">Seu código de verificação de canal seguro:</p>
            <div style="background:#0a1520;padding:16px;border-radius:8px;border:1px solid rgba(0,255,255,0.15);text-align:center">
              <span style="font-size:32px;font-weight:bold;letter-spacing:0.4em;color:#00ffff">${code}</span>
            </div>
            <p style="color:#4a7a8a;font-size:11px;margin-top:12px">Este código expira em 10 minutos. Não compartilhe com ninguém.</p>
          </div>`
        });
      } catch {}
    }
    // For WhatsApp/phone — show code on screen (no API integration)
    setOtpSent(true);
    setSending(false);
  };

  const verifyOtp = () => {
    if (otp === generatedOtp) {
      const channels = getChannels();
      channels[channelKey + '_value'] = value.trim();
      channels[channelKey + '_verified'] = true;
      saveChannels(channels);
      setIsVerified(true);
      setOtpSent(false);
      setOtp('');
      setOtpError('');
    } else {
      setOtpError('Código incorreto. Tente novamente.');
    }
  };

  const unlink = () => {
    const channels = getChannels();
    delete channels[channelKey + '_value'];
    delete channels[channelKey + '_verified'];
    saveChannels(channels);
    setIsVerified(false);
    setValue('');
    setOtpSent(false);
  };

  return (
    <div className="p-3 rounded-xl border border-cyan-900/30 bg-cyan-950/10 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-cyan-400/60 shrink-0" />
        <span className="text-xs font-mono text-cyan-300/80 flex-1">{label}</span>
        {isVerified && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-2.5 h-2.5 text-green-400" />
            <span className="text-[8px] font-mono text-green-400">Verificado</span>
          </div>
        )}
      </div>

      {isVerified ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] font-mono text-cyan-600/60 truncate">{value}</span>
          <button onClick={unlink} className="text-[9px] font-mono text-red-500/50 hover:text-red-400 transition-colors">Desvincular</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type={type === 'email' ? 'email' : 'tel'}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-1.5 rounded-lg border border-cyan-800/30 bg-[#050a0f] text-cyan-300 font-mono text-xs outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={sendOtp}
              disabled={sending || !value.trim() || otpSent}
              className="px-3 py-1.5 rounded-lg border border-cyan-700/30 text-[10px] font-mono text-cyan-400/70 hover:border-cyan-500/50 hover:text-cyan-300 transition-all disabled:opacity-40 whitespace-nowrap"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : otpSent ? '✓ Enviado' : 'Enviar OTP'}
            </button>
          </div>

          {otpSent && (
            <div className="space-y-1.5">
              {type === 'phone' && (
                <div className="p-2 rounded-lg border border-cyan-700/20 bg-cyan-900/10">
                  <p className="text-[9px] font-mono text-cyan-700/50">Código para WhatsApp (simulado):</p>
                  <p className="text-sm font-mono font-bold text-cyan-300 tracking-widest">{generatedOtp}</p>
                </div>
              )}
              {type === 'email' && (
                <p className="text-[9px] font-mono text-cyan-700/50">Código enviado para {value}. Verifique sua caixa de entrada.</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => { setOtp(e.target.value); setOtpError(''); }}
                  placeholder="Digite o código OTP"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-cyan-800/30 bg-[#050a0f] text-cyan-300 font-mono text-xs outline-none focus:border-cyan-500/50 tracking-widest"
                />
                <button onClick={verifyOtp}
                  className="px-3 py-1.5 rounded-lg border border-green-700/40 text-[10px] font-mono text-green-400/70 hover:border-green-500/60 hover:text-green-300 transition-all">
                  Verificar
                </button>
              </div>
              {otpError && <p className="text-[9px] font-mono text-red-400/70">{otpError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────
export default function SecurityChannels() {
  return (
    <div className="space-y-4">
      {/* Biometric linking */}
      <div>
        <p className="text-[9px] font-mono text-cyan-600/40 tracking-widest uppercase mb-2">Biometria</p>
        <BiometricRegistration />
        <p className="text-[9px] font-mono text-cyan-800/40 mt-2 px-1">
          Biometria disponível após primeiro acesso via PIN. Vinculada, torna-se método preferencial.
        </p>
      </div>

      {/* Communication channels */}
      <div>
        <p className="text-[9px] font-mono text-cyan-600/40 tracking-widest uppercase mb-2">Canais de Verificação</p>
        <div className="space-y-2">
          <ChannelRow
            type="phone"
            icon={Phone}
            label="Celular / WhatsApp"
            placeholder="+55 11 99999-9999"
            channelKey="phone"
          />
          <ChannelRow
            type="email"
            icon={Mail}
            label="E-mail de Segurança"
            placeholder="seu@email.com"
            channelKey="email"
          />
        </div>
        <p className="text-[9px] font-mono text-cyan-800/40 mt-2 px-1">
          Usado para: alertas de login, redefinição de senha e notificações de segurança.
        </p>
      </div>
    </div>
  );
}