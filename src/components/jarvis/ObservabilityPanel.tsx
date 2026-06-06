import { useState } from 'react'
import { X, Activity, GitBranch, Zap, BarChart2, Eye } from 'lucide-react'
import { useJarvisStore } from '@/store/useJarvisStore'

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Eye },
  { id: 'logs', label: 'Log de Execuções', icon: Activity },
  { id: 'github', label: 'GitHub', icon: GitBranch },
  { id: 'deploy', label: 'Deploy Monitor', icon: Zap },
  { id: 'metrics', label: 'Métricas', icon: BarChart2 },
]

export default function ObservabilityPanel() {
  const [activeTab, setActiveTab] = useState('overview')
  const { setShowObservability } = useJarvisStore()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a1628] border border-[#00FFFF]/30 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FFFF]/20">
          <div>
            <h2 className="text-[#00FFFF] font-mono font-bold text-sm">CENTRAL DE OBSERVABILIDADE</h2>
            <p className="text-[#37474F] font-mono text-xs">JARVIS NEXUS // MONITORING v2.0</p>
          </div>
          <button
            onClick={() => setShowObservability(false)}
            className="text-[#37474F] hover:text-[#FF4444] min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-[#00FFFF]/20">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-mono whitespace-nowrap min-h-[44px] transition-colors ${
                activeTab === tab.id
                  ? 'text-[#00FFFF] border-b-2 border-[#00FFFF]'
                  : 'text-[#37474F] hover:text-[#E0F7FA]'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-[#37474F] uppercase tracking-wider">Status das Integrações</p>
              {['GitHub', 'Vercel', 'Supabase', 'Telegram', 'Tavily'].map(name => (
                <div key={name} className="flex items-center justify-between p-3 bg-[#0d2030] rounded border border-[#00FFFF]/10">
                  <span className="font-mono text-sm text-[#E0F7FA]">{name}</span>
                  <span className="text-xs font-mono text-[#00FF88]">Conectado</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-2">
              <div className="flex gap-2 mb-3">
                <select className="bg-[#0d2030] border border-[#37474F]/30 rounded px-2 py-1 text-xs font-mono text-[#E0F7FA] flex-1">
                  <option>Todos os tipos</option>
                  <option>IA</option>
                  <option>GitHub</option>
                  <option>Deploy</option>
                </select>
                <select className="bg-[#0d2030] border border-[#37474F]/30 rounded px-2 py-1 text-xs font-mono text-[#E0F7FA] flex-1">
                  <option>Todos os status</option>
                  <option>Sucesso</option>
                  <option>Erro</option>
                </select>
              </div>
              <p className="text-center text-xs font-mono text-[#37474F] py-8">
                Nenhum log ainda. Execute uma ação para ver os logs aqui.
              </p>
            </div>
          )}

          {activeTab === 'github' && (
            <p className="text-center text-xs font-mono text-[#37474F] py-8">
              Configure o token GitHub nas integrações para ver a atividade.
            </p>
          )}

          {activeTab === 'deploy' && (
            <p className="text-center text-xs font-mono text-[#37474F] py-8">
              Configure o token Vercel nas integrações para monitorar deploys.
            </p>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Tarefas hoje', value: '0' },
                  { label: 'Taxa de sucesso', value: '—' },
                  { label: 'Modelo mais usado', value: 'Groq' },
                  { label: 'Erros hoje', value: '0' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0d2030] rounded border border-[#00FFFF]/10 p-3 text-center">
                    <div className="text-[#00FFFF] font-mono font-bold text-lg">{value}</div>
                    <div className="text-[#37474F] font-mono text-xs mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
