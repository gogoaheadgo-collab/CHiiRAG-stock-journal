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
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Auth failed' })
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  try {
    const { data: trades, error: tErr } = await adminSupabase.from('trades').select('*')
    if (tErr) return res.status(500).json({ error: 'trades fetch failed', detail: tErr.message })

    const { data: executions } = await adminSupabase.from('executions').select('*')
    const { data: profiles } = await adminSupabase.from('profiles').select('*')

    const userMap = {}

    ;(profiles || []).forEach(p => {
      userMap[p.id] = {
        id: p.id, email: p.email, full_name: p.full_name,
        avatar_url: p.avatar_url, created_at: p.created_at, status: p.status || 'pending',
      }
    })

    ;(trades || []).forEach(t => {
      if (!userMap[t.user_id]) {
        userMap[t.user_id] = {
          id: t.user_id, email: t.account || 'Unknown', full_name: null,
          avatar_url: null, created_at: t.entry_date, status: 'approved',
        }
      }
    })

    if (!userMap[user.id]) {
      userMap[user.id] = {
        id: user.id, email: user.email,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at, status: 'approved',
      }
    }

    const summary = Object.values(userMap).map(sub => {
      const userTrades = (trades || []).filter(t => t.user_id === sub.id)
      const userExecs  = (executions || []).filter(e => e.user_id === sub.id)
      const totalInvestment = userTrades.reduce((s, t) => s + (Number(t.invested_capital) || 0), 0)
      const realisedPnL = userTrades.reduce((s, t) => {
        const execs = userExecs.filter(e => e.trade_id === t.id)
        return s + execs.reduce((se, e) => se + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
      }, 0)
      return {
        id: sub.id, email: sub.email, full_name: sub.full_name,
        avatar_url: sub.avatar_url, created_at: sub.created_at, status: sub.status,
        totalTrades: userTrades.length,
        openTrades: userTrades.filter(t => t.status === 'OPEN').length,
        closedTrades: userTrades.filter(t => t.status === 'CLOSED').length,
        totalInvestment, realisedPnL,
        isAdmin: sub.email === ADMIN_EMAIL,
      }
    })

    return res.status(200).json(summary)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
