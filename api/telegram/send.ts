import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { botToken, chatId, message, parseMode = 'Markdown' } = req.body
  const token = botToken || process.env.TELEGRAM_COMANDO_TOKEN
  const chat = chatId || process.env.TELEGRAM_CHAT_ID

  if (!token || !chat) return res.status(400).json({ error: 'botToken e chatId obrigatórios' })

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: message, parse_mode: parseMode })
  })

  if (!response.ok) {
    const err = await response.json()
    return res.status(response.status).json({ error: err.description })
  }

  return res.json({ success: true })
}
