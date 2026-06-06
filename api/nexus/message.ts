import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { from_agent, to_agent, type, content, priority = 'normal', metadata = {}, parent_id } = req.body

  if (!from_agent || !to_agent || !content) {
    return res.status(400).json({ error: 'from_agent, to_agent e content são obrigatórios' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase não configurado no servidor' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.from('agent_messages').insert({
    from_agent, to_agent, type: type || 'message',
    content, priority, metadata, parent_id
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, message: data })
}
