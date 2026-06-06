import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { sendMagicLink } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      await sendMagicLink(email)
      setSent(true)
      toast.success('Link enviado! Verifique seu email.')
    } catch (err) {
      toast.error('Erro ao enviar link: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#050a0f] px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-[#00FFFF] font-mono text-xl font-bold">J.A.R.V.I.S. NEXUS</h1>
          <p className="text-[#37474F] font-mono text-xs mt-1">STARK LEGACY v7.0 // AUTHENTICATION</p>
        </div>

        {sent ? (
          <div className="text-center p-6 border border-[#00FF88]/30 rounded-lg bg-[#00FF88]/5">
            <p className="text-[#00FF88] font-mono text-sm">Link enviado para {email}</p>
            <p className="text-[#37474F] font-mono text-xs mt-2">Verifique sua caixa de entrada</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[#37474F] font-mono text-xs block mb-1">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-[#0d2030] border border-[#37474F]/30 rounded px-4 py-3 text-[#E0F7FA] font-mono text-sm focus:outline-none focus:border-[#00FFFF] min-h-[44px]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00FFFF]/20 border border-[#00FFFF] text-[#00FFFF] font-mono text-sm py-3 rounded hover:bg-[#00FFFF]/30 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Enviando...' : 'ENVIAR MAGIC LINK'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
