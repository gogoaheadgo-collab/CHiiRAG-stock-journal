import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  // Remap id -> user_id so the frontend subscribers.js handleApprove() works unchanged
  const remapped = (data || []).map(row => ({ ...row, user_id: row.id }))
  return res.status(200).json(remapped)
}
