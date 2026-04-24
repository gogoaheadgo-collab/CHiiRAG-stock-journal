import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DEFAULT_STRATEGIES = ['VCP CONTRACTION', 'IPO', 'TIPS', 'OTHER']
const ADMIN = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data } = await supabase.from('strategies').select('name').order('created_at')
    const list = data?.length ? data.map(s => s.name) : DEFAULT_STRATEGIES
    return res.json(list)
  }

  if (user.email !== ADMIN) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
    const { error } = await supabase.from('strategies').insert([{ name: name.trim().toUpperCase() }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { name } = req.body
    await supabase.from('strategies').delete().eq('name', name)
    return res.json({ ok: true })
  }

  res.status(405).end()
}
