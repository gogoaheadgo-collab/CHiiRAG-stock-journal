import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  const { data: trades } = await supabase.from('trades').select('*')
  const { data: executions } = await supabase.from('executions').select('*')

  const summary = (profiles || []).map(profile => {
    const userTrades = (trades || []).filter(t => t.user_id === profile.id)
    const userExecs = (executions || []).filter(e => e.user_id === profile.id)
    const totalInvestment = userTrades.reduce((s, t) => s + (Number(t.invested_capital) || 0), 0)
    const realisedPnL = userTrades.reduce((sum, t) => {
      const execs = userExecs.filter(e => e.trade_id === t.id)
      return sum + execs.reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    }, 0)
    return {
      id: profile.id, email: profile.email, full_name: profile.full_name,
      avatar_url: profile.avatar_url, created_at: profile.created_at,
      totalTrades: userTrades.length,
      openTrades: userTrades.filter(t => t.status === 'OPEN').length,
      closedTrades: userTrades.filter(t => t.status === 'CLOSED').length,
      totalInvestment, realisedPnL,
    }
  })
  return res.status(200).json(summary)
}
