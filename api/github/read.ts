import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { repo, path = '', owner } = req.body
  const token = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN || ''

  if (!token) return res.status(401).json({ error: 'Token GitHub não configurado' })
  if (!repo) return res.status(400).json({ error: 'repo é obrigatório' })

  let resolvedOwner = owner
  if (!resolvedOwner) {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const userData = await userRes.json()
    resolvedOwner = userData.login
  }

  const response = await fetch(
    `https://api.github.com/repos/${resolvedOwner}/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  )

  if (!response.ok) return res.status(response.status).json({ error: `Erro GitHub: ${response.status}` })

  const data = await response.json()

  if (!Array.isArray(data) && data.content) {
    return res.json({
      type: 'file',
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.sha, path: data.path, size: data.size
    })
  }

  return res.json({
    type: 'directory',
    items: (data as Record<string, unknown>[]).map(f => ({ name: f.name, path: f.path, type: f.type, size: f.size }))
  })
}
