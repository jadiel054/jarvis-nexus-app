import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text é obrigatório' })

  const key = (req.headers['x-gemini-key'] as string) || process.env.GEMINI_API_KEY || ''
  if (!key) return res.status(401).json({ error: 'Gemini API key não configurada' })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } })
    }
  )

  if (!response.ok) return res.status(response.status).json({ error: `Gemini embeddings error: ${response.status}` })
  const data = await response.json()
  return res.json({ embedding: data.embedding.values })
}
