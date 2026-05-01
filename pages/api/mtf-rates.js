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
    const { data } = await supabase
      .from('mtf_rates')
      .select('id, label, rate')
      .order('created_at')
    return res.json(Array.isArray(data) ? data : [])
  }

  if (user.email !== ADMIN) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    const { label, rate } = req.body
    if (!label?.trim()) return res.status(400).json({ error: 'Label required' })
    if (rate == null || isNaN(Number(rate))) return res.status(400).json({ error: 'Valid rate required' })
    const { error } = await supabase.from('mtf_rates').insert([{
      label: label.trim(),
      rate: Number(rate),
    }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })
    await supabase.from('mtf_rates').delete().eq('id', id)
    return res.json({ ok: true })
  }

  res.status(405).end()
}
