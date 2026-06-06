import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { repo, owner, branch, title, body: prBody = '', base = 'main' } = req.body
  const token = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN || ''

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body: prBody, head: branch, base })
  })

  if (!response.ok) {
    const err = await response.json()
    return res.status(response.status).json({ error: err.message })
  }

  const data = await response.json()
  return res.json({ success: true, prNumber: data.number, prUrl: data.html_url })
}
