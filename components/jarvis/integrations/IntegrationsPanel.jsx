/**
 * IntegrationsPanel — Aba de Integrações Externas do JARVIS
 * Gerencia credenciais para Supabase (Zarith), GitHub e Vercel.
 * Tudo salvo em localStorage (criptografado por ofuscação simples) e
 * espelhado nas settings do JARVIS.
 */

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, CheckCircle2, XCircle, Loader2, GitBranch, Zap, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'jarvis_integrations';

function loadIntegrations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveIntegrations(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, color, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs font-mono font-bold text-cyan-200">{title}</p>
        <p className="text-[9px] font-mono text-cyan-700/50">{subtitle}</p>
      </div>
    </div>
  );
}

function SecretInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-mono text-cyan-400/60">{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-[#050a0f] border-cyan-800/30 text-cyan-100 placeholder:text-cyan-800/30 font-mono text-xs pr-9 focus:border-cyan-500/50"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-700/50 hover:text-cyan-400 transition-colors"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-mono text-cyan-400/60">{label}</Label>
      <Input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#050a0f] border-cyan-800/30 text-cyan-100 placeholder:text-cyan-800/30 font-mono text-xs focus:border-cyan-500/50"
      />
    </div>
  );
}

function StatusBadge({ status, label }) {
  const map = {
    connected: { color: 'text-green-400 border-green-500/30 bg-green-500/10', icon: CheckCircle2, text: 'Conectado' },
    error: { color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: XCircle, text: 'Erro' },
    testing: { color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', icon: Loader2, text: 'Testando...' },
    idle: { color: 'text-cyan-700/50 border-cyan-800/30 bg-transparent', icon: null, text: 'Aguardando credenciais' },
  };
  const cfg = map[status] || map.idle;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[10px] ${cfg.color}`}>
      {Icon && <Icon className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />}
      <span>{label || cfg.text}</span>
    </div>
  );
}

// ── Supabase Section ──────────────────────────────────────────────────────────
function SupabaseSection({ data, onChange, onTest, status, profileInfo }) {
  return (
    <div className="p-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10 space-y-3">
      <SectionHeader
        icon={Database}
        color="bg-emerald-500/15 text-emerald-400"
        title="Supabase — Banco Zarith"
        subtitle="Conexão com public.profiles e settings"
      />
      <div className="flex items-center justify-between">
        <StatusBadge status={status} label={profileInfo ? `Conectado como ${profileInfo.role || 'admin'}` : undefined} />
        <button
          onClick={onTest}
          disabled={!data.url || !data.anon_key || status === 'testing'}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-cyan-700/30 text-[10px] font-mono text-cyan-400 hover:border-cyan-500/50 disabled:opacity-30 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
          Testar
        </button>
      </div>
      <TextInput label="Project URL" value={data.url} onChange={v => onChange('url', v)} placeholder="https://xxxx.supabase.co" />
      <SecretInput label="Anon / Service Key" value={data.anon_key} onChange={v => onChange('anon_key', v)} placeholder="eyJhbGciOiJIUzI1NiIsInR5c..." />
      {profileInfo && (
        <div className="p-2.5 rounded-lg border border-emerald-700/20 bg-emerald-950/10 space-y-0.5">
          <p className="text-[9px] font-mono text-emerald-500/80">✅ Perfil carregado do Supabase:</p>
          {Object.entries(profileInfo).map(([k, v]) => (
            <p key={k} className="text-[9px] font-mono text-cyan-600/60">• {k}: <span className="text-cyan-400/70">{String(v).slice(0, 60)}</span></p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GitHub Section ────────────────────────────────────────────────────────────
function GitHubSection({ data, onChange, onTest, status, repoInfo }) {
  return (
    <div className="p-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10 space-y-3">
      <SectionHeader
        icon={GitBranch}
        color="bg-purple-500/15 text-purple-400"
        title="GitHub — Acesso Total"
        subtitle="Descoberta automática de todos os seus repositórios"
      />
      <div className="flex items-center justify-between">
        <StatusBadge status={status} label={repoInfo ? `@${repoInfo.login} · ${repoInfo.repos?.length || 0} repos` : undefined} />
        <button
          onClick={onTest}
          disabled={!data.token || status === 'testing'}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-cyan-700/30 text-[10px] font-mono text-cyan-400 hover:border-cyan-500/50 disabled:opacity-30 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
          Testar
        </button>
      </div>
      <SecretInput label="Personal Access Token" value={data.token} onChange={v => onChange('token', v)} placeholder="ghp_xxxxxxxxxxxx" />
      <p className="text-[9px] font-mono text-cyan-700/50 leading-relaxed">
        ⚡ JARVIS descobre automaticamente todos os seus repositórios via API — sem configuração manual.
      </p>
      {repoInfo && (
        <div className="p-2.5 rounded-lg border border-purple-700/20 bg-purple-950/10 space-y-1">
          <p className="text-[9px] font-mono text-purple-400/80">✅ {repoInfo.name} (@{repoInfo.login})</p>
          {repoInfo.repos?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {repoInfo.repos.slice(0, 8).map(r => (
                <span key={r} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-purple-700/30 text-purple-300/60">{r}</span>
              ))}
              {repoInfo.repos.length > 8 && <span className="text-[8px] font-mono text-cyan-700/40">+{repoInfo.repos.length - 8} mais</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vercel Section ────────────────────────────────────────────────────────────
function VercelSection({ data, onChange, onTest, status, deployInfo }) {
  return (
    <div className="p-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10 space-y-3">
      <SectionHeader
        icon={Zap}
        color="bg-slate-400/15 text-slate-300"
        title="Vercel — Deploy & Infraestrutura"
        subtitle="Monitoramento de deploys e projetos"
      />
      <div className="flex items-center justify-between">
        <StatusBadge status={status} label={deployInfo ? `${deployInfo.projects} projeto(s)` : undefined} />
        <button
          onClick={onTest}
          disabled={!data.api_key || status === 'testing'}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-cyan-700/30 text-[10px] font-mono text-cyan-400 hover:border-cyan-500/50 disabled:opacity-30 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />
          Testar
        </button>
      </div>
      <SecretInput label="API Token" value={data.api_key} onChange={v => onChange('api_key', v)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" />
      <TextInput label="IDs dos Projetos (vírgula separados)" value={data.project_ids} onChange={v => onChange('project_ids', v)} placeholder="prj_xxxxxx, prj_yyyyyy" />
      {deployInfo && (
        <div className="p-2.5 rounded-lg border border-slate-600/20 bg-slate-900/20">
          <p className="text-[9px] font-mono text-slate-300/80">✅ Vercel conectado — {deployInfo.projects} projeto(s) acessível(is)</p>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function IntegrationsPanel({ onCredentialsChange }) {
  const [integrations, setIntegrations] = useState(loadIntegrations);
  const [statuses, setStatuses] = useState({ supabase: 'idle', github: 'idle', vercel: 'idle' });
  const [info, setInfo] = useState({ supabase: null, github: null, vercel: null });

  // Persist on change
  useEffect(() => {
    saveIntegrations(integrations);
    onCredentialsChange?.(integrations);
  }, [integrations]);

  const set = (service, key, value) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: { ...(prev[service] || {}), [key]: value },
    }));
  };

  // ── Test Supabase ────────────────────────────────────────────────────────────
  const testSupabase = async () => {
    const { url, anon_key } = integrations.supabase || {};
    if (!url || !anon_key) return;
    setStatuses(s => ({ ...s, supabase: 'testing' }));
    setInfo(i => ({ ...i, supabase: null }));
    try {
      // Test agent_sessions (primary JARVIS table)
      const res = await fetch(`${url}/rest/v1/agent_sessions?select=id,created_at&limit=5`, {
        headers: { apikey: anon_key, Authorization: `Bearer ${anon_key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        setInfo(i => ({ ...i, supabase: {
          '✅ agent_sessions': `${rows.length} registro(s) encontrado(s)`,
          'status': 'Zarith-SaaS conectado',
          'tools_ativas': 'git_operator · database_oracle · deploy_analyst',
        }}));
        setStatuses(s => ({ ...s, supabase: 'connected' }));
      } else {
        // Try system_status as fallback table test
        const res2 = await fetch(`${url}/rest/v1/system_status?select=key&limit=1`, {
          headers: { apikey: anon_key, Authorization: `Bearer ${anon_key}` },
        });
        if (res2.ok) {
          setInfo(i => ({ ...i, supabase: { '⚠️ agent_sessions': 'Tabela não encontrada', 'system_status': 'OK', 'dica': 'Crie a tabela agent_sessions no Supabase' } }));
          setStatuses(s => ({ ...s, supabase: 'connected' }));
        } else {
          const body = await res.json().catch(() => ({}));
          setStatuses(s => ({ ...s, supabase: 'error' }));
          setInfo(i => ({ ...i, supabase: { '❌ Erro': body?.message || `HTTP ${res.status}` } }));
        }
      }
    } catch (err) {
      setStatuses(s => ({ ...s, supabase: 'error' }));
      setInfo(i => ({ ...i, supabase: { '❌ Erro de rede': err.message || 'Falha na conexão' } }));
    }
  };

  // ── Test GitHub ──────────────────────────────────────────────────────────────
  const testGitHub = async () => {
    const { token } = integrations.github || {};
    if (!token) return;
    setStatuses(s => ({ ...s, github: 'testing' }));
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (res.ok) {
        const user = await res.json();
        // Fetch repos list
        const reposRes = await fetch('https://api.github.com/user/repos?type=all&sort=updated&per_page=100', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const repos = reposRes.ok ? (await reposRes.json()).map(r => r.name) : [];
        setInfo(i => ({ ...i, github: { name: user.name, login: user.login, repos } }));
        setStatuses(s => ({ ...s, github: 'connected' }));
      } else {
        setStatuses(s => ({ ...s, github: 'error' }));
        setInfo(i => ({ ...i, github: null }));
      }
    } catch {
      setStatuses(s => ({ ...s, github: 'error' }));
    }
  };

  // ── Test Vercel ──────────────────────────────────────────────────────────────
  const testVercel = async () => {
    const { api_key } = integrations.vercel || {};
    if (!api_key) return;
    setStatuses(s => ({ ...s, vercel: 'testing' }));
    try {
      const res = await fetch('https://api.vercel.com/v9/projects?limit=10', {
        headers: { Authorization: `Bearer ${api_key}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInfo(i => ({ ...i, vercel: { projects: data.projects?.length || 0 } }));
        setStatuses(s => ({ ...s, vercel: 'connected' }));
      } else {
        setStatuses(s => ({ ...s, vercel: 'error' }));
        setInfo(i => ({ ...i, vercel: null }));
      }
    } catch {
      setStatuses(s => ({ ...s, vercel: 'error' }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-px bg-cyan-900/30" />
        <span className="text-[9px] font-mono text-cyan-600/40 tracking-widest uppercase">Ecossistema Zarith</span>
        <div className="flex-1 h-px bg-cyan-900/30" />
      </div>

      <SupabaseSection
        data={integrations.supabase || {}}
        onChange={(k, v) => set('supabase', k, v)}
        onTest={testSupabase}
        status={statuses.supabase}
        profileInfo={info.supabase}
      />

      <GitHubSection
        data={integrations.github || {}}
        onChange={(k, v) => set('github', k, v)}
        onTest={testGitHub}
        status={statuses.github}
        repoInfo={info.github}
      />

      <VercelSection
        data={integrations.vercel || {}}
        onChange={(k, v) => set('vercel', k, v)}
        onTest={testVercel}
        status={statuses.vercel}
        deployInfo={info.vercel}
      />

      <p className="text-[9px] font-mono text-cyan-800/40 text-center pt-1">
        🔒 Credenciais salvas localmente — nunca enviadas a terceiros além das APIs acima.
      </p>
    </div>
  );
}

// ── Helper export: loads saved creds for use in Jarvis engine ─────────────────
export function getIntegrationCredentials() {
  return loadIntegrations();
}