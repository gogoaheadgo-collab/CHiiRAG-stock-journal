import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase.from('exit_reasons').select('name').order('created_at')
    return res.json(Array.isArray(data) ? data.map(r => r.name) : [])
  }

  if (user.email !== ADMIN) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
    const { error } = await supabase.from('exit_reasons').insert([{ name: name.trim() }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { name } = req.body
    await supabase.from('exit_reasons').delete().eq('name', name)
    return res.json({ ok: true })
  }

  res.status(405).end()
}
