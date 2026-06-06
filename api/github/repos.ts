import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN || ''
  if (!token) return res.status(401).json({ error: 'Token GitHub não configurado' })

  const response = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all',
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  )

  if (!response.ok) return res.status(response.status).json({ error: 'Erro ao listar repos' })

  const repos = await response.json()
  return res.json({
    repos: repos.map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, full_name: r.full_name,
      url: r.html_url, private: r.private, language: r.language,
      description: r.description, updated_at: r.updated_at, default_branch: r.default_branch
    }))
  })
}
