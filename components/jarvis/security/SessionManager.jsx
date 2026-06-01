import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Trash2, RefreshCw } from 'lucide-react';
import { getSessions, revokeSession, getDeviceId } from './deviceGuard';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const myDeviceId = getDeviceId();

  const refresh = () => setSessions(getSessions());

  useEffect(() => { refresh(); }, []);

  const handleRevoke = (deviceId) => {
    revokeSession(deviceId);
    refresh();
  };

  if (sessions.length === 0) {
    return (
      <div className="p-3 rounded-xl border border-cyan-900/30 bg-cyan-950/10 text-center">
        <p className="text-[10px] font-mono text-cyan-700/50">Nenhuma sessão registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-mono text-cyan-700/40 tracking-widest">DISPOSITIVOS CONECTADOS</p>
        <button onClick={refresh} className="text-cyan-800/50 hover:text-cyan-500/70 transition-colors">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      {sessions.map(s => {
        const isCurrent = s.deviceId === myDeviceId;
        const Icon = /iPhone|iPad|Android/i.test(s.label) ? Smartphone : Monitor;
        return (
          <div key={s.deviceId}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              isCurrent ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-900/20 bg-cyan-950/10'
            }`}>
            <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-cyan-400' : 'text-cyan-700/50'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-mono truncate ${isCurrent ? 'text-cyan-300' : 'text-cyan-600/60'}`}>
                {s.label} {isCurrent && <span className="text-[9px] text-cyan-500/60 border border-cyan-700/30 px-1 rounded">ESTE</span>}
              </p>
              <p className="text-[9px] font-mono text-cyan-800/50">
                {s.ip} · {s.location} · {timeAgo(s.lastSeen)}
              </p>
            </div>
            {!isCurrent && (
              <button onClick={() => handleRevoke(s.deviceId)}
                title="Encerrar sessão"
                className="p-1.5 rounded-lg border border-red-800/30 text-red-700/50 hover:border-red-600/50 hover:text-red-400 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}