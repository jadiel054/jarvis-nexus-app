/**
 * DeployMonitor — Painel de monitoramento de deploys da Vercel.
 * Mostra status em tempo real e aciona diagnóstico automático em falhas.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { getLatestDeploys, diagnoseFailedDeploy } from './integrations/useVercel';

const STATE_CONFIG = {
  READY:    { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle2, label: 'Sucesso' },
  ERROR:    { color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30',     icon: AlertTriangle, label: 'Falha' },
  BUILDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Loader2, label: 'Building' },
  CANCELED: { color: 'text-gray-400',  bg: 'bg-gray-500/10 border-gray-500/30',   icon: X, label: 'Cancelado' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function DeployMonitor({ onDiagnosis }) {
  const [deploys, setDeploys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [diagnosing, setDiagnosing] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchDeploys = useCallback(async () => {
    setLoading(true);
    const result = await getLatestDeploys();
    setLoading(false);
    setLastRefresh(Date.now());
    if (!result.error) {
      setDeploys(result.deploys || []);
      // Auto-diagnose latest ERROR deploy
      const failed = (result.deploys || []).find(d => d.state === 'ERROR');
      if (failed && typeof onDiagnosis === 'function') {
        handleDiagnose(failed, result.deploys);
      }
    }
  }, []);

  useEffect(() => {
    fetchDeploys();
    // Poll every 60s
    const interval = setInterval(fetchDeploys, 60000);
    return () => clearInterval(interval);
  }, [fetchDeploys]);

  const handleDiagnose = async (deploy, allDeploys = deploys) => {
    setDiagnosing(deploy.id);
    const diagnosis = await diagnoseFailedDeploy(deploy.id, deploy.name);
    setDiagnosing(null);
    if (typeof onDiagnosis === 'function') {
      onDiagnosis(`🚨 **Deploy com falha detectado: ${deploy.name}**\n\n${diagnosis}`);
    }
  };

  const latest = deploys[0];
  const hasError = deploys.some(d => d.state === 'ERROR');

  if (!localStorage.getItem('jarvis_integrations')?.includes('"api_key"')) return null;

  return (
    <div className={`mx-4 mb-2 rounded-xl border overflow-hidden transition-all ${hasError ? 'border-red-500/30' : 'border-cyan-900/25'}`}
      style={{ background: hasError ? 'rgba(239,68,68,0.03)' : 'rgba(6,13,22,0.7)' }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-500/5 transition-colors"
      >
        <Zap className={`w-3.5 h-3.5 ${hasError ? 'text-red-400' : 'text-cyan-500/60'}`} />
        <span className="text-[9px] font-mono text-cyan-500/60 tracking-widest uppercase flex-1 text-left">
          Vercel Deploy Monitor
        </span>
        {latest && (() => {
          const cfg = STATE_CONFIG[latest.state] || STATE_CONFIG.CANCELED;
          const Icon = cfg.icon;
          return (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[9px] font-mono ${cfg.bg} ${cfg.color}`}>
              <Icon className={`w-2.5 h-2.5 ${latest.state === 'BUILDING' ? 'animate-spin' : ''}`} />
              {cfg.label}
            </div>
          );
        })()}
        <button onClick={e => { e.stopPropagation(); fetchDeploys(); }}
          className="p-1 text-cyan-700/40 hover:text-cyan-400 transition-colors">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {expanded ? <ChevronUp className="w-3 h-3 text-cyan-700/40" /> : <ChevronDown className="w-3 h-3 text-cyan-700/40" />}
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-cyan-900/20 pt-2">
          {deploys.length === 0 && !loading && (
            <p className="text-[10px] font-mono text-cyan-700/40 text-center py-2">
              Nenhum deploy encontrado. Configure o token Vercel nas Integrações.
            </p>
          )}
          {deploys.map(d => {
            const cfg = STATE_CONFIG[d.state] || STATE_CONFIG.CANCELED;
            const Icon = cfg.icon;
            return (
              <div key={d.id} className={`flex items-center gap-2 p-2 rounded-lg border ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color} ${d.state === 'BUILDING' ? 'animate-spin' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-mono font-bold truncate ${cfg.color}`}>{d.name}</p>
                  <p className="text-[9px] font-mono text-cyan-700/40">{timeAgo(d.createdAt)}</p>
                </div>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-mono text-cyan-500/60 hover:text-cyan-300 underline">
                    Ver
                  </a>
                )}
                {d.state === 'ERROR' && (
                  <button
                    onClick={() => handleDiagnose(d)}
                    disabled={diagnosing === d.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/40 text-[9px] font-mono text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                  >
                    {diagnosing === d.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '🔍'}
                    {diagnosing === d.id ? 'Analisando...' : 'Diagnosticar'}
                  </button>
                )}
              </div>
            );
          })}
          {lastRefresh && (
            <p className="text-[9px] font-mono text-cyan-800/30 text-center">
              Atualizado {timeAgo(lastRefresh)} · Auto-refresh: 60s
            </p>
          )}
        </div>
      )}
    </div>
  );
}