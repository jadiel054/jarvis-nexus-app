export const JARVIS_VERSION = '7.0.0'
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export const AGENT_TRIGGERS = [
  'analisa', 'corrige', 'implementa', 'cria', 'refatora',
  'migra', 'configura', 'deploy', 'commit', 'push',
  'zarith', 'repositório', 'github', 'vercel', 'supabase'
] as const

export const QUICK_COMMANDS = [
  { id: 'clima', label: 'Clima', emoji: '☀️' },
  { id: 'calcular', label: 'Calcular', emoji: '🧮' },
  { id: 'rota', label: 'Rota', emoji: '🗺️' },
  { id: 'piada', label: 'Piada', emoji: '😄' },
  { id: 'signo', label: 'Signo', emoji: '♈' },
] as const
