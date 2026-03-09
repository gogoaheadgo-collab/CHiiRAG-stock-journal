import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Auth failed', detail: authErr?.message })
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only', yourEmail: user.email })

  // Check service role key exists
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Vercel env vars' })

  const { data: { users: authUsers }, error: usersErr } = await adminSupabase.auth.admin.listUsers()
  if (usersErr) return res.status(500).json({ error: 'listUsers failed', detail: usersErr.message })

  const { data: trades, error: tradesErr } = await adminSupabase.from('trades').select('*')
  const { data: executions } = await adminSupabase.from('executions').select('*')

  const summary = (authUsers || []).map(u => {
    const userTrades = (trades || []).filter(t => t.user_id === u.id)
    const userExecs = (executions || []).filter(e => e.user_id === u.id)
    const totalInvestment = userTrades.reduce((s, t) => s + (Number(t.invested_capital) || 0), 0)
    const realisedPnL = userTrades.reduce((sum, t) => {
      const execs = userExecs.filter(e => e.trade_id === t.id)
      return sum + execs.reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    }, 0)
    return {
      id: u.id, email: u.email,
      full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
      avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
      created_at: u.created_at,
      totalTrades: userTrades.length,
      openTrades: userTrades.filter(t => t.status === 'OPEN').length,
      closedTrades: userTrades.filter(t => t.status === 'CLOSED').length,
      totalInvestment, realisedPnL,
      isAdmin: u.email === ADMIN_EMAIL,
    }
  })

  return res.status(200).json(summary)
}
