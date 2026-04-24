import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../../lib/cors'

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'GET') {
    const { data } = await adminSupabase.from('mirrored_accounts').select('*').eq('admin_id', user.id)
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { subscriber_id, subscriber_name, subscriber_email } = req.body
    const { data, error: e } = await adminSupabase.from('mirrored_accounts')
      .upsert([{ admin_id: user.id, subscriber_id, subscriber_name, subscriber_email }], { onConflict: 'admin_id,subscriber_id' })
      .select().single()
    if (e) return res.status(500).json({ error: e.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { subscriber_id } = req.body
    await adminSupabase.from('mirrored_accounts').delete().eq('admin_id', user.id).eq('subscriber_id', subscriber_id)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
