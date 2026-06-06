import { useState } from 'react'
import { X, User, Mic, Cpu, Plug, Send, Shield, Save } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useJarvisStore } from '@/store/useJarvisStore'
import { toast } from 'sonner'

const TABS = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'voice', label: 'Voz', icon: Mic },
  { id: 'models', label: 'Motores IA', icon: Cpu },
  { id: 'integrations', label: 'Integrações', icon: Plug },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'security', label: 'Segurança', icon: Shield },
]

const AI_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Groq LLaMA 3.3', description: 'Rápido e gratuito', icon: 'G' },
  { id: 'gemini-1.5-flash', name: 'Gemini Flash', description: 'Rápido com visão', icon: 'Gm' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Visão & multimodal', icon: 'Gm' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Código complexo', icon: 'C' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', description: 'Raciocínio profundo', icon: 'D' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', description: 'Coder avançado', icon: 'Q' },
]

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('models')
  const { integrations, setIntegration } = useSettingsStore()
  const { setShowSettings } = useJarvisStore()

  function handleSave() {
    toast.success('Configurações salvas!')
    setShowSettings(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-jarvis-bg-secondary border border-jarvis-cyan/30 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-cyan/20">
          <div>
            <h2 className="text-jarvis-cyan font-mono font-bold text-sm">CENTRAL DE COMANDO</h2>
            <p className="text-jarvis-text-dim font-mono text-xs">STARK LEGACY v7.0 // SYSTEM CONFIG</p>
          </div>
          <button onClick={() => setShowSettings(false)} className="text-jarvis-text-dim hover:text-jarvis-red min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-jarvis-cyan/20 px-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-mono whitespace-nowrap transition-colors min-h-[44px] ${
                activeTab === tab.id
                  ? 'text-jarvis-cyan border-b-2 border-jarvis-cyan'
                  : 'text-jarvis-text-dim hover:text-jarvis-text'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'models' && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-jarvis-text-dim uppercase tracking-wider">Cérebro Principal</p>
              {AI_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setIntegration('activeModel', model.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left min-h-[44px] ${
                    integrations.activeModel === model.id
                      ? 'border-jarvis-cyan bg-jarvis-cyan/10'
                      : 'border-jarvis-text-dim/20 hover:border-jarvis-cyan/40'
                  }`}
                >
                  <span className="text-xl font-mono font-bold text-jarvis-cyan">{model.icon}</span>
                  <div className="flex-1">
                    <p className="text-jarvis-text font-mono text-sm">{model.name}</p>
                    <p className="text-jarvis-text-dim font-mono text-xs">{model.description}</p>
                  </div>
                  {integrations.activeModel === model.id && (
                    <span className="text-xs border border-jarvis-cyan text-jarvis-cyan px-2 py-0.5 rounded font-mono">ATIVO</span>
                  )}
                </button>
              ))}

              <p className="text-xs font-mono text-jarvis-text-dim uppercase tracking-wider mt-4">Chaves de API</p>
              {[
                { key: 'claudeApiKey', label: 'Claude API Key' },
                { key: 'groqApiKey', label: 'Groq API Key' },
                { key: 'geminiApiKey', label: 'Gemini API Key' },
                { key: 'openrouterApiKey', label: 'OpenRouter API Key' },
                { key: 'deepseekApiKey', label: 'DeepSeek API Key' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-mono text-jarvis-text-dim">{label}</label>
                  <input
                    type="password"
                    value={(integrations as unknown as Record<string, string>)[key] || ''}
                    onChange={e => setIntegration(key, e.target.value)}
                    placeholder="sk-..."
                    className="w-full mt-1 bg-jarvis-bg border border-jarvis-text-dim/30 rounded px-3 py-2 text-jarvis-text font-mono text-sm focus:outline-none focus:border-jarvis-cyan min-h-[44px]"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-3">
              {[
                { key: 'githubToken', label: 'GitHub Token', placeholder: 'ghp_...' },
                { key: 'vercelToken', label: 'Vercel Token', placeholder: 'token...' },
                { key: 'tavilyApiKey', label: 'Tavily API Key', placeholder: 'tvly-...' },
                { key: 'elevenLabsApiKey', label: 'ElevenLabs API Key', placeholder: 'sk_...' },
                { key: 'openweathermapKey', label: 'OpenWeatherMap Key', placeholder: 'key...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-mono text-jarvis-text-dim">{label}</label>
                  <input
                    type="password"
                    value={(integrations as unknown as Record<string, string>)[key] || ''}
                    onChange={e => setIntegration(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full mt-1 bg-jarvis-bg border border-jarvis-text-dim/30 rounded px-3 py-2 text-jarvis-text font-mono text-sm focus:outline-none focus:border-jarvis-cyan min-h-[44px]"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'telegram' && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-jarvis-text-dim">Configure os tokens dos bots Telegram</p>
              {[
                { key: 'telegramComandoToken', label: 'JarvisComando Token' },
                { key: 'telegramAlertsToken', label: 'JarvisAlerts Token' },
                { key: 'telegramDevToken', label: 'JarvisDev Token' },
                { key: 'telegramChatId', label: 'Seu Chat ID' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-mono text-jarvis-text-dim">{label}</label>
                  <input
                    type="password"
                    value={(integrations as unknown as Record<string, string>)[key] || ''}
                    onChange={e => setIntegration(key, e.target.value)}
                    className="w-full mt-1 bg-jarvis-bg border border-jarvis-text-dim/30 rounded px-3 py-2 text-jarvis-text font-mono text-sm focus:outline-none focus:border-jarvis-cyan min-h-[44px]"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-jarvis-text-dim uppercase tracking-wider mb-3">Biometria</p>
              <p className="text-sm font-mono text-jarvis-text-dim">Configuração de segurança disponível nas opções do dispositivo.</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-jarvis-text-dim uppercase tracking-wider">Perfil do Operador</p>
              <p className="text-sm font-mono text-jarvis-text-dim">Configure seu perfil nas opções do Supabase Auth.</p>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-4">
              <p className="text-xs font-mono text-jarvis-text-dim uppercase tracking-wider">Configurações de Voz</p>
              <p className="text-sm font-mono text-jarvis-text-dim">Web Speech API ativa. Kokoro TTS em desenvolvimento.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-jarvis-cyan/20">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-jarvis-cyan/20 border border-jarvis-cyan text-jarvis-cyan font-mono text-sm py-3 rounded-lg hover:bg-jarvis-cyan/30 transition-colors min-h-[44px]"
          >
            <Save size={16} />
            SALVAR CONFIGURAÇÕES
          </button>
        </div>
      </div>
    </div>
  )
}
