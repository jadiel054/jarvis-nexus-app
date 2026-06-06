import { useState, useEffect } from 'react'
import { Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'

interface Deployment {
  id: string
  name: string
  state: string
}

export default function DeployMonitor() {
  const [expanded, setExpanded] = useState(false)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const { integrations } = useSettingsStore()

  useEffect(() => {
    if (!integrations.vercelToken) { setStatus('error'); return }
    fetch('/api/deploy/vercel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-vercel-token': integrations.vercelToken },
      body: JSON.stringify({ limit: 5 })
    })
      .then(r => r.json())
      .then(data => { setDeployments(data.deployments || []); setStatus('success') })
      .catch(() => setStatus('error'))
  }, [integrations.vercelToken])

  return (
    <div className="mx-4 my-2 border border-[#00FFFF]/20 rounded-lg bg-[#0d2030] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#00FFFF]" />
          <span className="font-mono text-xs text-[#00FFFF]">VERCEL DEPLOY MONITOR</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
            status === 'success' ? 'border-[#00FF88] text-[#00FF88]' : 'border-[#37474F] text-[#37474F]'
          }`}>
            {status === 'success' ? 'Sucesso' : status === 'loading' ? '...' : 'Erro'}
          </span>
          {expanded ? <ChevronUp size={14} className="text-[#37474F]" /> : <ChevronDown size={14} className="text-[#37474F]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {deployments.map((d) => (
            <div key={d.id} className="flex items-center justify-between border border-[#00FF88]/20 rounded p-2">
              <span className="text-xs font-mono text-[#E0F7FA] truncate flex-1">{d.name}</span>
              <span className={`text-xs font-mono ml-2 ${d.state === 'READY' ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>
                {d.state}
              </span>
            </div>
          ))}
          {deployments.length === 0 && (
            <p className="text-xs font-mono text-[#37474F] text-center py-2">
              {status === 'error' ? 'Configure o token Vercel nas integrações' : 'Nenhum deploy encontrado'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
