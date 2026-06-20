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

  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, full_name, email, status')
    .in('status', ['approved', 'rejected'])

  const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
  const authMap = {}
  authUsers?.users?.forEach(u => { authMap[u.id] = { email: u.email, name: u.user_metadata?.full_name || u.email } })

  const result = (profiles || []).map(p => ({
    id: p.id,
    name: p.full_name || authMap[p.id]?.name || p.email || p.id,
    email: p.email || authMap[p.id]?.email || '',
  }))

  return res.status(200).json(result)
}
