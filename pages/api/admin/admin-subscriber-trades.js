import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const { data: trades } = await adminSupabase.from('trades').select('*').eq('user_id', user_id).order('entry_date', { ascending: false })
  const { data: executions } = await adminSupabase.from('executions').select('*').eq('user_id', user_id)

  return res.status(200).json({ trades: trades || [], executions: executions || [] })
}
