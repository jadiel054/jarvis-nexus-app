import { motion } from 'framer-motion'

interface Props { agentName: string }

export default function ThinkingStatus({ agentName }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="w-8 h-8 rounded-full bg-[#0d2030] border border-[#00FFFF]/30 flex items-center justify-center text-sm">
        🤖
      </div>
      <div>
        <span className="text-[#37474F] font-mono text-xs">{agentName} • </span>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[#00FFFF] font-mono text-xs"
        >
          processando...
        </motion.span>
      </div>
      <div className="flex gap-1 ml-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#00FFFF]"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}
