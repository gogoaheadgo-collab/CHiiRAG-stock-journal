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
  if (authErr || !user) return res.status(401).json({ error: 'Auth failed' })
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  try {
    const { data: trades, error: tErr } = await adminSupabase.from('trades').select('*')
    if (tErr) return res.status(500).json({ error: 'trades fetch failed', detail: tErr.message })

    const { data: executions } = await adminSupabase.from('executions').select('*')
    const { data: profiles } = await adminSupabase.from('profiles').select('*')

    // Build approved-only set — only users with status='approved' in profiles (admin always included)
    const approvedIds = new Set(
      (profiles || []).filter(p => p.status === 'approved').map(p => p.id)
    )
    approvedIds.add(user.id) // admin always visible

    const userMap = {}

    // 1. Try to get all users from Supabase auth admin API — filter to approved only
    try {
      const { data: authData } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
      ;(authData?.users || []).forEach(u => {
        if (!approvedIds.has(u.id)) return // skip pending/rejected
        userMap[u.id] = {
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
          avatar_url: u.user_metadata?.avatar_url || null,
          created_at: u.created_at,
        }
      })
    } catch {}

    // 2. Fallback: profiles table (approved only)
    ;(profiles || []).forEach(p => {
      if (!approvedIds.has(p.id)) return
      if (!userMap[p.id]) userMap[p.id] = { id: p.id, email: p.email, full_name: p.full_name, avatar_url: p.avatar_url, created_at: p.created_at }
    })

    // 3. Fallback: users found in trades (only if already approved)
    ;(trades || []).forEach(t => {
      if (!approvedIds.has(t.user_id)) return
      if (!userMap[t.user_id]) {
        userMap[t.user_id] = { id: t.user_id, email: t.account || 'Unknown', full_name: null, avatar_url: null, created_at: t.entry_date }
      }
    })

    // 4. Ensure admin is always present
    if (!userMap[user.id]) {
      userMap[user.id] = { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || null, avatar_url: user.user_metadata?.avatar_url || null, created_at: user.created_at }
    }

    const summary = Object.values(userMap).map(u => {
      const userTrades = (trades || []).filter(t => t.user_id === u.id)
      const userExecs = (executions || []).filter(e => e.user_id === u.id)
      const totalInvestment = userTrades.reduce((s, t) => s + (Number(t.invested_capital) || 0), 0)
      const realisedPnL = userTrades.reduce((sum, t) => {
        const execs = userExecs.filter(e => e.trade_id === t.id)
        if (execs.length > 0) {
          return sum + execs.reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
        }
        return sum + (Number(t.realized_gains) || 0)
      }, 0)
      return {
        id: u.id, email: u.email, full_name: u.full_name, avatar_url: u.avatar_url, created_at: u.created_at,
        totalTrades: userTrades.length,
        openTrades: userTrades.filter(t => t.status === 'OPEN').length,
        closedTrades: userTrades.filter(t => t.status === 'CLOSED').length,
        totalInvestment, realisedPnL,
        isAdmin: u.email === ADMIN_EMAIL,
      }
    })

    return res.status(200).json(summary)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
