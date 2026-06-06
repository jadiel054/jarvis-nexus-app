export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  modelUsed?: string
  isAgentMode?: boolean
  isError?: boolean
  feedback?: 'like' | 'dislike'
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  agentKey: string
  createdAt: number
  updatedAt: number
}

export interface JarvisIntegrations {
  activeModel: string
  claudeApiKey?: string
  groqApiKey?: string
  geminiApiKey?: string
  openrouterApiKey?: string
  deepseekApiKey?: string
  glmApiKey?: string
  elevenLabsApiKey?: string
  elevenLabsVoiceId?: string
  githubToken?: string
  githubUsername?: string
  vercelToken?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  renderApiKey?: string
  railwayToken?: string
  netlifyToken?: string
  telegramComandoToken?: string
  telegramAlertsToken?: string
  telegramDevToken?: string
  telegramChatId?: string
  tavilyApiKey?: string
  openweathermapKey?: string
  openrouteserviceKey?: string
  resendApiKey?: string
}

export interface UserProfile {
  name?: string
  email?: string
  location?: string
  avatar?: string
}

export interface DigitalAsset {
  id: string
  name: string
  url?: string
  type: 'SaaS' | 'site' | 'app' | 'domínio' | 'outro'
  askingPrice: number
  paidPrice?: number
  monthlyRevenue: number
  status: 'analyzing' | 'approved' | 'discarded' | 'purchased'
  score?: number
  analysis?: Record<string, unknown>
  notes?: string
  createdAt: string
}
