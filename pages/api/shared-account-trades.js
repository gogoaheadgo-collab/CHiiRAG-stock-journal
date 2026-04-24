import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: shares, error: shareErr } = await admin
    .from('shared_accounts').select('*').eq('subscriber_id', user.id)
  if (shareErr) return res.status(500).json({ error: shareErr.message })
  if (!shares || shares.length === 0) return res.status(200).json({ trades: [], executions: [] })

  const { data: { users } } = await admin.auth.admin.listUsers()
  const adminUser = users?.find(u => u.email === ADMIN_EMAIL)
  if (!adminUser) return res.status(500).json({ error: 'Admin not found' })

  const sharedAccountNames = shares.map(s => s.account_name)

  const { data: trades, error: tradeErr } = await admin
    .from('trades')
    .select('*')
    .eq('user_id', adminUser.id)
    .in('account', sharedAccountNames)
    .order('entry_date', { ascending: false })
  if (tradeErr) return res.status(500).json({ error: tradeErr.message })

  const tradeIds = (trades || []).map(t => t.id)
  let executions = []
  if (tradeIds.length > 0) {
    const { data: execs } = await admin.from('executions').select('*').in('trade_id', tradeIds)
    executions = execs || []
  }

  return res.status(200).json({ trades: trades || [], executions })
}
