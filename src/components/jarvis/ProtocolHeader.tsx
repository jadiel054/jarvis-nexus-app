import { useState, useEffect } from 'react'
import { Activity, BarChart2, History, Settings } from 'lucide-react'
import { useJarvisStore } from '@/store/useJarvisStore'

export default function ProtocolHeader() {
  const [time, setTime] = useState(new Date())
  const [sessionId] = useState(() => String(Math.floor(Math.random() * 99999)).padStart(5, '0'))
  const {
    combatMode, setCombatMode,
    setShowObservability, setShowSettings
  } = useJarvisStore()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = time.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="border-b border-[#00FFFF]/20 px-4 py-2 bg-[#050a0f]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[#00FFFF] font-mono text-xs">
            PROTOCOL ID: {sessionId} // SECURE CHANNEL
          </div>
          <div className="text-[#37474F] font-mono text-xs capitalize">{dateStr}</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#00FFFF] font-mono text-sm">
            {time.toLocaleTimeString('pt-BR')}
          </span>
          <button onClick={() => setShowObservability(true)} className="p-2 text-[#37474F] hover:text-[#00FFFF] min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Activity size={16} />
          </button>
          <button onClick={() => setShowObservability(true)} className="p-2 text-[#37474F] hover:text-[#00FFFF] min-w-[44px] min-h-[44px] flex items-center justify-center">
            <BarChart2 size={16} />
          </button>
          <button className="p-2 text-[#37474F] hover:text-[#00FFFF] min-w-[44px] min-h-[44px] flex items-center justify-center">
            <History size={16} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-[#37474F] hover:text-[#00FFFF] min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="font-mono text-xs text-[#37474F]">
          {combatMode ? 'PROTOCOLO DE COMBATE // MODO ATIVO' : 'PROTOCOLO AMIGÁVEL // MODO PADRÃO'}
        </span>
        <button
          onClick={() => setCombatMode(!combatMode)}
          className={`text-xs font-mono px-3 py-1 border rounded min-h-[44px] ${
            combatMode
              ? 'border-[#FF4444] text-[#FF4444]'
              : 'border-[#00FFFF]/40 text-[#00FFFF]/60 hover:border-[#00FFFF]'
          }`}
        >
          {combatMode ? 'DESATIVAR' : 'COMBATE'}
        </button>
      </div>
    </div>
  )
}
