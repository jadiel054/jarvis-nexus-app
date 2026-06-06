import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { repo, owner, branch = `jarvis/fix-${Date.now()}`, filePath, content, message, sha } = req.body
  const token = (req.headers['x-github-token'] as string) || process.env.GITHUB_TOKEN || ''

  if (!token) return res.status(401).json({ error: 'Token GitHub não configurado' })

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' }
  const base = `https://api.github.com/repos/${owner}/${repo}`

  if (branch !== 'main') {
    try {
      const branchCheck = await fetch(`${base}/git/ref/heads/${branch}`, { headers })
      if (!branchCheck.ok) {
        const mainRef = await fetch(`${base}/git/ref/heads/main`, { headers })
        const mainData = await mainRef.json()
        const mainSha = mainData.object.sha
        await fetch(`${base}/git/refs`, {
          method: 'POST', headers,
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha })
        })
      }
    } catch { /* branch creation is best-effort */ }
  }

  const body: Record<string, unknown> = { message, content: Buffer.from(content).toString('base64'), branch }
  if (sha) body.sha = sha

  const commitRes = await fetch(`${base}/contents/${filePath}`, {
    method: 'PUT', headers, body: JSON.stringify(body)
  })

  if (!commitRes.ok) {
    const err = await commitRes.json()
    return res.status(commitRes.status).json({ error: err.message })
  }

  const data = await commitRes.json()
  return res.json({ success: true, commitSha: data.commit.sha, commitUrl: data.commit.html_url, branch })
}
