import type { VercelRequest, VercelResponse } from '@vercel/node'

function detectProvider(model: string): string {
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('mixtral') || model.startsWith('llama')) return 'groq'
  if (model.startsWith('deepseek')) return 'deepseek'
  if (model.includes('/')) return 'openrouter'
  return 'groq'
}

function getKey(provider: string, headers: Record<string, string | string[] | undefined>): string {
  const envMap: Record<string, string> = {
    anthropic: process.env.CLAUDE_API_KEY || '',
    google: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
  }
  const headerMap: Record<string, string> = {
    anthropic: (headers['x-claude-key'] as string) || '',
    google: (headers['x-gemini-key'] as string) || '',
    groq: (headers['x-groq-key'] as string) || '',
    deepseek: (headers['x-deepseek-key'] as string) || '',
    openrouter: (headers['x-openrouter-key'] as string) || '',
  }
  return headerMap[provider] || envMap[provider] || ''
}

async function callGroq(model: string, messages: unknown[], system: string, key: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 4096 })
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callGemini(model: string, messages: unknown[], system: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const contents = (messages as { role: string; content: string }[]).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
    })
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

async function callOpenRouter(model: string, messages: unknown[], system: string, key: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': 'https://jarvis-nexus.vercel.app' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 4096 })
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callClaude(model: string, messages: unknown[], system: string, key: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages })
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

async function callDeepSeek(model: string, messages: unknown[], system: string, key: string) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 4096 })
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function callModel(provider: string, model: string, messages: unknown[], system: string, key: string) {
  if (!key) throw new Error(`API key não configurada para ${provider}`)
  switch (provider) {
    case 'anthropic': return callClaude(model, messages, system, key)
    case 'google': return callGemini(model, messages, system, key)
    case 'groq': return callGroq(model, messages, system, key)
    case 'openrouter': return callOpenRouter(model, messages, system, key)
    case 'deepseek': return callDeepSeek(model, messages, system, key)
    default: throw new Error(`Provider desconhecido: ${provider}`)
  }
}

const FALLBACK_ORDER = [
  { model: 'llama-3.3-70b-versatile', provider: 'groq' },
  { model: 'gemini-1.5-flash', provider: 'google' },
  { model: 'deepseek/deepseek-r1:free', provider: 'openrouter' },
  { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, model = 'llama-3.3-70b-versatile', systemPrompt = '' } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages é obrigatório' })

  const provider = detectProvider(model)
  const key = getKey(provider, req.headers)

  try {
    const response = await callModel(provider, model, messages, systemPrompt, key)
    return res.json({ response, modelUsed: model })
  } catch (primaryError) {
    for (const fallback of FALLBACK_ORDER) {
      if (fallback.model === model) continue
      try {
        const fallbackKey = getKey(fallback.provider, req.headers)
        const response = await callModel(fallback.provider, fallback.model, messages, systemPrompt, fallbackKey)
        return res.json({ response, modelUsed: fallback.model, usedFallback: true })
      } catch { continue }
    }
    return res.status(503).json({
      error: 'Todos os modelos falharam. Verifique suas API keys.',
      details: String(primaryError)
    })
  }
}
