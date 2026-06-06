import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Save, User, Mic, Cpu, Loader2, Shield, KeyRound, Plug } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import BiometricGate from './BiometricGate';
import SessionManager from './security/SessionManager';
import SecurityChannels from './security/SecurityChannels';
import IntegrationsPanel from './integrations/IntegrationsPanel';

// ── Constants ──────────────────────────────────────────────────────────────────
const VOICE_STYLES = [
  { value: 'natural', label: '🎙️ Natural' },
  { value: 'robotic', label: '🤖 Robótico' },
  { value: 'deep_robotic', label: '⚡ Deep' },
  { value: 'cinematic', label: '🎬 Cinematográfico' },
  { value: 'stark', label: '🔬 Stark Tech' },
  { value: 'empathetic', label: '💙 Empático' },
  { value: 'custom', label: '✨ Personalizado' },
];

const LANGUAGES = [
  { value: 'pt-BR', label: '🇧🇷 Português' },
  { value: 'en-US', label: '🇺🇸 English' },
  { value: 'es-ES', label: '🇪🇸 Español' },
];

const VOICE_SPEEDS = [
  { value: 0.75, label: 'Lento' },
  { value: 1.0, label: 'Normal' },
  { value: 1.25, label: 'Rápido' },
  { value: 1.5, label: 'Turbo' },
];

const AI_MODELS = [
  { value: 'auto', label: '🤖 Automático', description: 'Seleciona o melhor modelo' },
  { value: 'claude', label: '🧠 Claude 3.5', description: 'Código complexo & análise' },
  { value: 'groq_mixtral', label: '⚡ Groq Mixtral', description: 'Ultra-rápido' },
  { value: 'groq_llama', label: '⚡ Groq LLaMA 3', description: 'Rápido e poderoso' },
  { value: 'gemini_pro', label: '💎 Gemini 1.5 Pro', description: 'Visão & multimodal' },
  { value: 'gemini_flash', label: '💎 Gemini Flash', description: 'Rápido com visão' },
];

const TABS = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'voice', label: 'Voz', icon: Mic },
  { id: 'engines', label: 'Motores IA', icon: Cpu },
  { id: 'integrations', label: 'Integrações', icon: Plug },
  { id: 'security', label: 'Segurança', icon: Shield },
];

// ── Shared UI Atoms ────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-cyan-300/70 font-mono">{label}</Label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = 'text' }) => (
  <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="bg-[#050a0f] border-cyan-800/30 text-cyan-50 placeholder:text-cyan-800/40 focus:border-cyan-500/50 font-mono text-sm" />
);

const ApiKeyField = ({ value, onChange, label, placeholder, showKey, onToggleShow }) => (
  <Field label={label}>
    <div className="relative">
      <Input type={showKey ? 'text' : 'password'} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#050a0f] border-cyan-800/30 text-cyan-50 placeholder:text-cyan-800/40 focus:border-cyan-500/50 font-mono text-xs pr-9" />
      <button type="button" onClick={onToggleShow}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-600/50 hover:text-cyan-400 transition-colors">
        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  </Field>
);

const OptionGroup = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button key={opt.value} onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
          value == opt.value
            ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
            : 'border-cyan-800/30 hover:border-cyan-700/50 text-cyan-600/60'
        }`}>
        {opt.label}
      </button>
    ))}
  </div>
);

const Divider = ({ label }) => (
  <div className="flex items-center gap-2 pt-1">
    <div className="text-[9px] font-mono text-cyan-600/40 tracking-widest uppercase">{label}</div>
    <div className="flex-1 h-px bg-cyan-900/30" />
  </div>
);

const HudSlider = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = '%', color = 'cyan' }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <Field label={`${label} — ${value}${unit}`}>
      <div className="relative h-6 flex items-center">
        <div className="w-full h-1.5 rounded-full bg-cyan-950/60 relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, background: color === 'orange' ? 'rgba(251,146,60,0.6)' : 'rgba(0,255,255,0.4)' }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-6" />
        <div className="absolute pointer-events-none"
          style={{ left: `calc(${pct}% - 6px)` }}>
          <div className="w-3 h-3 rounded-full border border-cyan-400/80 bg-[#050a0f]"
            style={{ boxShadow: '0 0 6px rgba(0,255,255,0.5)' }} />
        </div>
      </div>
    </Field>
  );
};

// ── Tab: Perfil ────────────────────────────────────────────────────────────────
function TabProfile({ form, set }) {
  const sarcasmColor = form.sarcasm_level > 70 ? 'orange' : 'cyan';
  return (
    <div className="space-y-4">
      <Divider label="Identidade" />
      <Field label="Nome do Assistente">
        <TextInput value={form.assistant_name} onChange={v => set('assistant_name', v)} placeholder="J.A.R.V.I.S." />
      </Field>
      <Field label="Seu Nome">
        <TextInput value={form.user_name} onChange={v => set('user_name', v)} placeholder="Como o assistente deve te chamar?" />
      </Field>

      <Divider label="Dados Pessoais" />
      <Field label="Data de Nascimento">
        <TextInput value={form.user_birthday} onChange={v => set('user_birthday', v)} type="date" />
      </Field>
      <Field label="Cidade Preferida">
        <TextInput value={form.preferred_city} onChange={v => set('preferred_city', v)} placeholder="Ex: São Paulo" />
      </Field>

      <Divider label="Personalidade" />
      <HudSlider
        label="Nível de Sarcasmo Stark"
        value={form.sarcasm_level ?? 30}
        onChange={v => set('sarcasm_level', v)}
        color={sarcasmColor}
      />
      {(form.sarcasm_level ?? 30) > 70 && (
        <p className="text-[9px] font-mono text-orange-400/70 px-1">
          ⚡ Modo Stark ativado — ironia e deboche inteligente liberados acima de 70%.
        </p>
      )}

    </div>
  );
}

// ── Tab: Voz ──────────────────────────────────────────────────────────────────
function TabVoice({ form, set }) {
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const fetchVoices = async () => {
    if (!form.elevenlabs_api_key) return;
    setLoadingVoices(true);
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': form.elevenlabs_api_key }
    });
    if (res.ok) setVoices((await res.json()).voices || []);
    setLoadingVoices(false);
  };

  useEffect(() => { if (form.elevenlabs_api_key) fetchVoices(); }, []);

  return (
    <div className="space-y-4">
      <Divider label="Idioma" />
      <Field label="Idioma da Interface">
        <OptionGroup value={form.language} onChange={v => set('language', v)} options={LANGUAGES} />
      </Field>

      <Divider label="Estilo & Velocidade" />
      <Field label="Estilo de Voz">
        <OptionGroup value={form.voice_style} onChange={v => set('voice_style', v)} options={VOICE_STYLES} />
      </Field>
      <Field label="Velocidade">
        <OptionGroup value={form.voice_speed} onChange={v => set('voice_speed', v)} options={VOICE_SPEEDS} />
      </Field>

      <Divider label="ElevenLabs — Parâmetros" />
      <Field label="Voice ID (Manual)">
        <TextInput value={form.elevenlabs_voice_id} onChange={v => set('elevenlabs_voice_id', v)} placeholder="ID da voz ElevenLabs" />
      </Field>
      <HudSlider label="Estabilidade" value={form.voice_stability ?? 70} onChange={v => set('voice_stability', v)} />
      <HudSlider label="Clareza / Similaridade" value={form.voice_clarity ?? 75} onChange={v => set('voice_clarity', v)} />

      <Divider label="Vozes da Conta" />
      {form.elevenlabs_api_key ? (
        <>
          <button onClick={fetchVoices} disabled={loadingVoices}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-700/40 text-[10px] font-mono text-cyan-400 hover:border-cyan-500/60 transition-all disabled:opacity-50">
            {loadingVoices ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔄'}
            {loadingVoices ? 'Carregando...' : `Atualizar Vozes${voices.length ? ` (${voices.length})` : ''}`}
          </button>
          {voices.length > 0 && (
            <div className="grid gap-1.5 max-h-36 overflow-y-auto pr-1">
              {voices.map(v => (
                <button key={v.voice_id} onClick={() => set('elevenlabs_voice_id', v.voice_id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                    form.elevenlabs_voice_id === v.voice_id
                      ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                      : 'border-cyan-900/30 hover:border-cyan-800/50 text-cyan-600/60'
                  }`}>
                  <span className="text-xs">🎙️</span>
                  <span className="text-[11px] font-mono">{v.name}</span>
                  <span className="ml-auto text-[9px] text-cyan-800/50">{v.category || 'premade'}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[10px] font-mono text-cyan-800/50">Adicione sua ElevenLabs API Key na aba <span className="text-cyan-600">Motores IA</span>.</p>
      )}
    </div>
  );
}

// ── Tab: Segurança ─────────────────────────────────────────────────────────────
function TabSecurity({ form, set }) {
  const [pinChange, setPinChange] = useState({ show: false, current: '', next: '', confirm: '', error: '' });

  const savePin = () => {
    const stored = localStorage.getItem('jarvis_emergency_pin');
    // First-time setup: no existing PIN, so skip current-PIN check
    if (stored && pinChange.current !== stored) {
      setPinChange(p => ({ ...p, error: 'PIN atual incorreto.' })); return;
    }
    if (pinChange.next.length < 6) {
      setPinChange(p => ({ ...p, error: 'Novo PIN deve ter ao menos 6 dígitos.' })); return;
    }
    if (pinChange.next !== pinChange.confirm) {
      setPinChange(p => ({ ...p, error: 'Os PINs não coincidem.' })); return;
    }
    localStorage.setItem('jarvis_emergency_pin', pinChange.next);
    setPinChange({ show: false, current: '', next: '', confirm: '', error: '' });
  };

  return (
    <div className="space-y-4">
      {/* Biometric & channels */}
      <SecurityChannels />

      <Divider label="PIN de Acesso (6 Dígitos)" />
      <div className="p-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10 space-y-3">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-cyan-400/60" />
          <div className="flex-1">
            <p className="text-xs font-mono text-cyan-300/80">Senha Principal de Acesso</p>
            <p className="text-[9px] font-mono text-cyan-700/50">{localStorage.getItem('jarvis_emergency_pin') ? 'PIN configurado — altere se necessário' : 'Nenhum PIN definido — configure agora para proteger novos dispositivos'}</p>
          </div>
        </div>
        {!pinChange.show ? (
          <button onClick={() => setPinChange(p => ({ ...p, show: true }))}
            className="w-full py-2 rounded-xl font-mono text-xs border border-cyan-700/30 text-cyan-400/70 hover:border-cyan-500/50 hover:text-cyan-300 transition-all">
            🔑 Alterar PIN de 6 Dígitos
          </button>
        ) : (
          <div className="space-y-2">
            {['current', 'next', 'confirm'].map((field, idx) => (
              <input key={field} type="password" inputMode="numeric"
                placeholder={['PIN atual (123456 se for 1º acesso)', 'Novo PIN (mín. 6 dígitos)', 'Confirmar novo PIN'][idx]}
                value={pinChange[field]}
                onChange={e => setPinChange(p => ({ ...p, [field]: e.target.value, error: '' }))}
                className="w-full px-3 py-2 rounded-lg border border-cyan-800/30 bg-[#050a0f] text-cyan-300 font-mono text-xs outline-none focus:border-cyan-500/50"
              />
            ))}
            {pinChange.error && <p className="text-[10px] font-mono text-red-400/80">{pinChange.error}</p>}
            <div className="flex gap-2">
              <button onClick={savePin} className="flex-1 py-2 rounded-xl font-mono text-xs border border-cyan-600/40 text-cyan-400 hover:bg-cyan-500/10 transition-all">Salvar</button>
              <button onClick={() => setPinChange({ show: false, current: '', next: '', confirm: '', error: '' })}
                className="flex-1 py-2 rounded-xl font-mono text-xs border border-cyan-900/30 text-cyan-700/50 hover:text-cyan-500 transition-all">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <Divider label="Sessões Ativas" />
      <SessionManager />
    </div>
  );
}

// ── Tab: Motores IA ────────────────────────────────────────────────────────────
function TabEngines({ form, set, showKeys, toggleShow }) {
  return (
    <div className="space-y-4">
      <Divider label="Cérebro Principal" />
      <div className="grid gap-2">
        {AI_MODELS.map(m => (
          <button key={m.value} onClick={() => set('ai_model', m.value)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              (form.ai_model || 'auto') === m.value
                ? 'border-cyan-500/60 bg-cyan-500/10'
                : 'border-cyan-900/30 hover:border-cyan-800/50'
            }`}>
            <span className="text-base">{m.label.split(' ')[0]}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-mono truncate ${(form.ai_model || 'auto') === m.value ? 'text-cyan-200' : 'text-cyan-600/60'}`}>
                {m.label.substring(m.label.indexOf(' ') + 1)}
              </p>
              <p className="text-[9px] text-cyan-800/50">{m.description}</p>
            </div>
            {(form.ai_model || 'auto') === m.value && (
              <span className="text-[9px] font-mono text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded shrink-0">ATIVO</span>
            )}
          </button>
        ))}
      </div>

      <Divider label="Chaves de API" />
      <ApiKeyField value={form.claude_api_key} onChange={v => set('claude_api_key', v)}
        label="🧠 Claude API Key" placeholder="sk-ant-api03-..."
        showKey={showKeys.claude_api_key} onToggleShow={() => toggleShow('claude_api_key')} />
      <ApiKeyField value={form.groq_api_key} onChange={v => set('groq_api_key', v)}
        label="⚡ Groq API Key" placeholder="gsk_..."
        showKey={showKeys.groq_api_key} onToggleShow={() => toggleShow('groq_api_key')} />
      <ApiKeyField value={form.gemini_api_key} onChange={v => set('gemini_api_key', v)}
        label="💎 Gemini API Key" placeholder="AIzaSy..."
        showKey={showKeys.gemini_api_key} onToggleShow={() => toggleShow('gemini_api_key')} />
      <ApiKeyField value={form.elevenlabs_api_key} onChange={v => set('elevenlabs_api_key', v)}
        label="🎙️ ElevenLabs API Key" placeholder="xxxxxxxxxxxxxxxx"
        showKey={showKeys.elevenlabs_api_key} onToggleShow={() => toggleShow('elevenlabs_api_key')} />
      <ApiKeyField value={form.elevenlabs_design_key} onChange={v => set('elevenlabs_design_key', v)}
        label="🎨 ElevenLabs Voice Design Key" placeholder="Clonagem e design de vozes"
        showKey={showKeys.elevenlabs_design_key} onToggleShow={() => toggleShow('elevenlabs_design_key')} />
      <ApiKeyField value={form.openweather_api_key} onChange={v => set('openweather_api_key', v)}
        label="🌤️ OpenWeatherMap Key" placeholder="xxxxxxxxxxxxxxxx"
        showKey={showKeys.openweather_api_key} onToggleShow={() => toggleShow('openweather_api_key')} />
      <ApiKeyField value={form.openrouteservice_api_key} onChange={v => set('openrouteservice_api_key', v)}
        label="🗺️ OpenRouteService Key" placeholder="5b3ce3..."
        showKey={showKeys.openrouteservice_api_key} onToggleShow={() => toggleShow('openrouteservice_api_key')} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SettingsPanel({ settings, onSave, onClose }) {
  const [biometricPassed, setBiometricPassed] = useState(!settings?.biometric_enabled);
  const [form, setForm] = useState({
    voice_style: 'robotic', language: 'pt-BR', voice_speed: 1.0,
    assistant_name: 'J.A.R.V.I.S.', ai_model: 'auto',
    sarcasm_level: 30, voice_stability: 70, voice_clarity: 75,
    biometric_enabled: false,
    ...settings
  });
  const [activeTab, setActiveTab] = useState('profile');
  const [showKeys, setShowKeys] = useState({});

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleShow = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  // Show biometric gate if enabled and not yet passed
  if (!biometricPassed) {
    return (
      <BiometricGate
        onSuccess={() => setBiometricPassed(true)}
        onCancel={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#080f1a] border border-cyan-800/30 rounded-2xl overflow-hidden animate-fade-in-up shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(0,255,255,0.05)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/30"
          style={{ background: 'linear-gradient(135deg, #0a1520 0%, #050a0f 100%)' }}>
          <div>
            <h2 className="text-base font-bold text-cyan-300 font-mono tracking-wider">CENTRAL DE COMANDO</h2>
            <p className="text-[9px] font-mono text-cyan-600/40 mt-0.5 tracking-widest">STARK LEGACY v5.0 // SYSTEM CONFIG</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors">
            <X className="w-4 h-4 text-cyan-400/60" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-cyan-900/30 bg-[#050a0f]">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-mono tracking-wide transition-all border-b-2 ${
                  active ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5' : 'border-transparent text-cyan-700/50 hover:text-cyan-500/70'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[58vh] overflow-y-auto">
          {activeTab === 'profile' && <TabProfile form={form} set={set} />}
          {activeTab === 'voice' && <TabVoice form={form} set={set} />}
          {activeTab === 'engines' && <TabEngines form={form} set={set} showKeys={showKeys} toggleShow={toggleShow} />}
          {activeTab === 'integrations' && <IntegrationsPanel />}
          {activeTab === 'security' && <TabSecurity form={form} set={set} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-900/30 bg-[#050a0f]">
          <Button onClick={() => { onSave(form); onClose(); }}
            className="w-full font-mono text-sm tracking-wider"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,255,0.1) 0%, rgba(0,128,255,0.1) 100%)',
              border: '1px solid rgba(0,255,255,0.3)', color: '#67e8f9',
              boxShadow: '0 0 20px rgba(0,255,255,0.08)',
            }}>
            <Save className="w-4 h-4 mr-2" />
            SALVAR CONFIGURAÇÕES
          </Button>
        </div>
      </div>
    </div>
  );
}