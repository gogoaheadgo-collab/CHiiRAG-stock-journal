import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { from, to } = req.query
  let q = admin.from('result_announcements').select('*').order('result_date', { ascending: true })
  if (from) q = q.gte('result_date', from)
  if (to)   q = q.lte('result_date', to)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data || [])
}
