import { useAgentStore } from '@/store/useAgentStore'

export default function AgentPlanningPanel() {
  const { plan } = useAgentStore()

  if (plan.length === 0) return null

  return (
    <div className="mx-2 mb-2 border border-[#00FFFF]/20 rounded-lg bg-[#0d2030] p-3">
      <p className="text-xs font-mono text-[#00FFFF] mb-2 uppercase tracking-wider">Plano de Execução</p>
      <div className="space-y-1">
        {plan.map((task, i) => (
          <div key={task.id} className="flex items-center gap-2">
            <span className={`text-xs font-mono ${
              task.status === 'done' ? 'text-[#00FF88]' :
              task.status === 'executing' ? 'text-[#00FFFF]' :
              task.status === 'failed' ? 'text-[#FF4444]' :
              'text-[#37474F]'
            }`}>
              {task.status === 'done' ? '[OK]' :
               task.status === 'executing' ? '[>>]' :
               task.status === 'failed' ? '[!!]' :
               `[${i + 1}]`}
            </span>
            <span className="text-xs font-mono text-[#E0F7FA]">{task.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
