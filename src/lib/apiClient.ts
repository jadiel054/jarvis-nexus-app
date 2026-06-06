import type { JarvisIntegrations } from '@/types/jarvis'

export async function callJarvisAPI(
  endpoint: string,
  body: object,
  integrations: JarvisIntegrations
): Promise<{ response: string; modelUsed: string; usedFallback?: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (integrations.claudeApiKey) headers['x-claude-key'] = integrations.claudeApiKey
  if (integrations.groqApiKey) headers['x-groq-key'] = integrations.groqApiKey
  if (integrations.geminiApiKey) headers['x-gemini-key'] = integrations.geminiApiKey
  if (integrations.openrouterApiKey) headers['x-openrouter-key'] = integrations.openrouterApiKey
  if (integrations.deepseekApiKey) headers['x-deepseek-key'] = integrations.deepseekApiKey
  if (integrations.githubToken) headers['x-github-token'] = integrations.githubToken
  if (integrations.vercelToken) headers['x-vercel-token'] = integrations.vercelToken

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API error: ${res.status}`)
  }

  return res.json()
}
