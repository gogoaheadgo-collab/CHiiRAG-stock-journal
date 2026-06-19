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
  if (error || !user) return res.status(401).json({ error: 'Auth failed', detail: error?.message })
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const [
    { data: trades, error: tErr },
    { data: executions, error: eErr },
    { data: accounts },
  ] = await Promise.all([
    adminSupabase.from('trades').select('*').eq('user_id', user_id).order('entry_date', { ascending: false }),
    adminSupabase.from('executions').select('*').eq('user_id', user_id),
    adminSupabase.from('accounts').select('id, name, available_fund').eq('user_id', user_id),
  ])

  return res.status(200).json({
    trades: trades || [],
    executions: executions || [],
    accounts: accounts || [],
    debug: {
      user_id_received: user_id,
      trades_count: trades?.length,
      trades_error: tErr?.message || null,
      exec_error: eErr?.message || null,
    }
  })
}
