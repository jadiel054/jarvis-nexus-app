import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { query, maxResults = 5 } = req.method === 'GET' ? req.query : req.body
  if (!query) return res.status(400).json({ error: 'query obrigatório' })

  const key = process.env.TAVILY_API_KEY

  if (key) {
    try {
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: Number(maxResults), search_depth: 'basic', include_answer: true })
      })
      if (tavilyRes.ok) {
        const data = await tavilyRes.json()
        return res.json({
          results: data.results?.map((r: Record<string, string>) => ({ title: r.title, url: r.url, description: r.content })),
          answer: data.answer,
          source: 'tavily'
        })
      }
    } catch { /* fall through to DuckDuckGo */ }
  }

  try {
    const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query as string)}&format=json&no_html=1`)
    const ddgData = await ddgRes.json()
    const results = (ddgData.RelatedTopics || [])
      .filter((r: Record<string, string>) => r.Text)
      .slice(0, Number(maxResults))
      .map((r: Record<string, string>) => ({ title: r.Text, url: r.FirstURL, description: r.Text }))
    return res.json({ results, source: 'duckduckgo' })
  } catch (err) {
    return res.status(500).json({ error: 'Busca indisponível', details: String(err) })
  }
}
