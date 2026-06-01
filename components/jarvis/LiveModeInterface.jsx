import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Keyboard, Camera, Upload, Mic, MicOff, X, CameraOff } from 'lucide-react';

// Audio visualizer bars
function AudioVisualizer({ isActive, color = '#00FFFF' }) {
  const bars = 28;
  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 48 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: 3,
            backgroundColor: color,
            boxShadow: isActive ? `0 0 6px ${color}` : 'none',
            height: isActive
              ? `${20 + Math.abs(Math.sin((Date.now() / 300 + i * 0.5))) * 28}px`
              : '6px',
            opacity: isActive ? 0.85 : 0.25,
            animation: isActive ? `bar-bounce-${i % 5} ${0.6 + (i % 4) * 0.15}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// Pulsing orb (JARVIS visual center)
function JarvisOrb({ isJarvisSpeaking, isUserSpeaking }) {
  const color = isJarvisSpeaking ? '#0080FF' : isUserSpeaking ? '#00FFFF' : '#00FFFF';
  const label = isJarvisSpeaking ? 'JARVIS' : isUserSpeaking ? 'Ouvindo...' : 'Aguardando...';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer rings */}
        {[120, 90, 64].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: size,
              height: size,
              borderColor: `${color}${['18', '28', '40'][i]}`,
              animation: `hud-rotate ${12 + i * 6}s linear infinite ${i % 2 ? 'reverse' : ''}`,
              boxShadow: i === 2 ? `0 0 12px ${color}30` : 'none',
            }}
          />
        ))}
        {/* Core */}
        <div
          className="relative w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${color}30 0%, ${color}08 70%, transparent 100%)`,
            boxShadow: `0 0 24px ${color}50, 0 0 48px ${color}20`,
            animation: 'pulse-orb 2s ease-in-out infinite',
          }}
        >
          <span className="text-2xl font-bold font-mono" style={{ color }}>J</span>
        </div>
      </div>

      <span className="text-xs font-mono tracking-widest" style={{ color, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

export default function LiveModeInterface({
  isJarvisSpeaking,
  isUserSpeaking,
  onClose,
  onSwitchToText,
  onFileSelect,
  onMuteToggle,
  isMuted,
  transcript,
  jarvisReply,
}) {
  const [cameraOn, setCameraOn] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tick, setTick] = useState(0);

  // Animate visualizer
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  // Camera
  const toggleCamera = async () => {
    if (cameraOn && videoStream) {
      videoStream.getTracks().forEach(t => t.stop());
      setVideoStream(null);
      setCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setVideoStream(stream);
        setCameraOn(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {}
    }
  };

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  useEffect(() => {
    return () => { videoStream?.getTracks().forEach(t => t.stop()); };
  }, [videoStream]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect?.(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Keyframe styles */}
      <style>{`
        @keyframes pulse-orb {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes bar-bounce-0 { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
        @keyframes bar-bounce-1 { from { transform: scaleY(0.6); } to { transform: scaleY(1); } }
        @keyframes bar-bounce-2 { from { transform: scaleY(0.3); } to { transform: scaleY(0.9); } }
        @keyframes bar-bounce-3 { from { transform: scaleY(0.7); } to { transform: scaleY(1); } }
        @keyframes bar-bounce-4 { from { transform: scaleY(0.5); } to { transform: scaleY(0.95); } }
        @keyframes glow-pulse-blue {
          0%, 100% { opacity: 0.5; transform: scaleX(1); }
          50% { opacity: 0.85; transform: scaleX(1.04); }
        }
        @keyframes glow-pulse-orange {
          0%, 100% { opacity: 0.3; transform: scaleX(1); }
          50% { opacity: 0.6; transform: scaleX(1.06); }
        }
        @keyframes fade-in-up-live {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: '#050a0f' }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* ── TOP BAR ────────────────────────────────── */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-10 pb-4">
          {/* Left spacer */}
          <div className="w-10" />

          {/* Center: JARVIS icon + Live label */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full border border-cyan-400/50 flex items-center justify-center"
              style={{ boxShadow: '0 0 8px #00FFFF50' }}
            >
              <span className="text-xs font-bold text-cyan-300 font-mono">J</span>
            </div>
            <span className="text-white font-semibold text-base tracking-wide">Live</span>
            {/* Live dot */}
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>

          {/* Right: Keyboard icon */}
          <button
            onClick={onSwitchToText}
            className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-all"
            title="Abrir chat de texto"
          >
            <Keyboard className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* ── CENTER AREA ────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10 px-6">
          {/* Camera preview (if on) */}
          {cameraOn && (
            <div className="w-36 h-36 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            </div>
          )}

          {/* JARVIS Orb */}
          <JarvisOrb isJarvisSpeaking={isJarvisSpeaking} isUserSpeaking={isUserSpeaking} />

          {/* Audio Visualizer */}
          <AudioVisualizer
            isActive={isJarvisSpeaking || isUserSpeaking}
            color={isJarvisSpeaking ? '#0080FF' : '#00FFFF'}
          />

          {/* Transcript / Reply bubble */}
          <div className="w-full max-w-xs min-h-[60px] flex flex-col gap-2 items-center">
            {transcript && (
              <div
                className="px-4 py-2 rounded-2xl text-sm text-center text-white/80 max-w-full"
                style={{
                  background: 'rgba(0,255,255,0.06)',
                  border: '1px solid rgba(0,255,255,0.15)',
                  animation: 'fade-in-up-live 0.3s ease-out',
                }}
              >
                {transcript}
              </div>
            )}
            {jarvisReply && (
              <div
                className="px-4 py-2 rounded-2xl text-sm text-center max-w-full"
                style={{
                  color: '#60aaff',
                  background: 'rgba(0,128,255,0.08)',
                  border: '1px solid rgba(0,128,255,0.18)',
                  animation: 'fade-in-up-live 0.3s ease-out',
                }}
              >
                {jarvisReply}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM GLOW AURA ───────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 220 }}>
          {/* Blue aura */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: '140%',
              height: 180,
              background: 'radial-gradient(ellipse at center bottom, rgba(0,128,255,0.22) 0%, rgba(0,80,200,0.10) 50%, transparent 100%)',
              animation: 'glow-pulse-blue 3s ease-in-out infinite',
              filter: 'blur(8px)',
            }}
          />
          {/* Orange accent aura */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: '80%',
              height: 100,
              background: 'radial-gradient(ellipse at center bottom, rgba(255,140,0,0.18) 0%, rgba(255,80,0,0.08) 60%, transparent 100%)',
              animation: 'glow-pulse-orange 4s ease-in-out infinite',
              filter: 'blur(12px)',
            }}
          />
        </div>

        {/* ── BOTTOM BUTTON BAR ──────────────────────── */}
        <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-12 pt-4">
          {/* Camera */}
          <button
            onClick={toggleCamera}
            className="flex items-center gap-2 px-5 py-3 rounded-full transition-all"
            style={{
              background: cameraOn ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.07)',
              border: cameraOn ? '1px solid rgba(0,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
              boxShadow: cameraOn ? '0 0 14px rgba(0,255,255,0.2)' : 'none',
            }}
          >
            {cameraOn
              ? <Camera className="w-5 h-5 text-cyan-300" />
              : <CameraOff className="w-5 h-5 text-white/50" />
            }
          </button>

          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-3 rounded-full transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Upload className="w-5 h-5 text-white/50" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Mute */}
          <button
            onClick={onMuteToggle}
            className="flex items-center gap-2 px-5 py-3 rounded-full transition-all"
            style={{
              background: isMuted ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.07)',
              border: isMuted ? '1px solid rgba(255,80,80,0.35)' : '1px solid rgba(255,255,255,0.12)',
              boxShadow: isMuted ? '0 0 12px rgba(255,60,60,0.2)' : 'none',
            }}
          >
            {isMuted
              ? <MicOff className="w-5 h-5 text-red-400" />
              : <Mic className="w-5 h-5 text-white/60" />
            }
          </button>

          {/* End session */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-3 rounded-full transition-all"
            style={{
              background: 'rgba(255,40,40,0.15)',
              border: '1px solid rgba(255,60,60,0.4)',
              boxShadow: '0 0 14px rgba(255,40,40,0.2)',
            }}
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>
    </>
  );
}