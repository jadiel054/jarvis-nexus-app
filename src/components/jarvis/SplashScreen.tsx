import { motion } from 'framer-motion'

export default function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#050a0f]">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-[#00FFFF] font-mono text-center"
      >
        <div className="text-4xl mb-4">🤖</div>
        <div className="text-lg">J.A.R.V.I.S.</div>
        <div className="text-xs text-[#37474F] mt-2">INICIALIZANDO...</div>
        <div className="mt-4 h-1 w-48 bg-[#0d2030] rounded overflow-hidden">
          <motion.div
            className="h-full bg-[#00FFFF] rounded"
            animate={{ width: ['0%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  )
}
