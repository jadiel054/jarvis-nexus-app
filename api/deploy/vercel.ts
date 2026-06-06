import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = (req.headers['x-vercel-token'] as string) || process.env.VERCEL_TOKEN || ''
  if (!token) return res.status(401).json({ error: 'Token Vercel não configurado' })

  const { projectId, limit = 10 } = req.body || req.query

  const url = projectId
    ? `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=${limit}`
    : `https://api.vercel.com/v6/deployments?limit=${limit}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!response.ok) return res.status(response.status).json({ error: 'Erro ao buscar deployments' })

  const data = await response.json()
  return res.json({
    deployments: data.deployments?.map((d: Record<string, unknown>) => ({
      id: d.uid, name: d.name, url: d.url,
      state: d.state, created: d.created,
      ready: d.ready, target: d.target
    }))
  })
}
