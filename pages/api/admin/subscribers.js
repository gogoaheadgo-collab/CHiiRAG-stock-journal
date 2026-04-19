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
    // Get all trades and executions using service role (bypasses RLS)
    const { data: trades, error: tErr } = await adminSupabase.from('trades').select('*')
    if (tErr) return res.status(500).json({ error: 'trades fetch failed', detail: tErr.message })

    const { data: executions } = await adminSupabase.from('executions').select('*')
    const { data: profiles } = await adminSupabase.from('profiles').select('*')

    // Build unique user list from trades (works even without profiles table)
    const userMap = {}

    // Add from profiles if available — include status field
    ;(profiles || []).forEach(profileRow => {
      userMap[profileRow.id] = {
        id:         profileRow.id,
        email:      profileRow.email,
        full_name:  profileRow.full_name,
        avatar_url: profileRow.avatar_url,
        created_at: profileRow.created_at,
        status:     profileRow.status || 'pending',   // ← status now included
      }
    })

    // Add any users found in trades but not in profiles
    ;(trades || []).forEach(tradeRow => {
      if (!userMap[tradeRow.user_id]) {
        userMap[tradeRow.user_id] = {
          id:         tradeRow.user_id,
          email:      tradeRow.account || 'Unknown',
          full_name:  null,
          avatar_url: null,
          created_at: tradeRow.entry_date,
          status:     'approved',   // trades exist → treat as approved
        }
      }
    })

    // Make sure admin is included
    if (!userMap[user.id]) {
      userMap[user.id] = {
        id:         user.id,
        email:      user.email,
        full_name:  user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at,
        status:     'approved',
      }
    }

    const summary = Object.values(userMap).map(subRow => {
      const userTradesArr = (trades || []).filter(trRow => trRow.user_id === subRow.id)
      const userExecsArr  = (executions || []).filter(exRow => exRow.user_id === subRow.id)
      const totalInvestment = userTradesArr.reduce((sumInv, trInv) => sumInv + (Number(trInv.invested_capital) || 0), 0)
      const realisedPnL = userTradesArr.reduce((sumPnl, trPnl) => {
        const trExecs = userExecsArr.filter(exPnl => exPnl.trade_id === trPnl.id)
        return sumPnl + trExecs.reduce((sEx, eEx) => sEx + (Number(eEx.price) - Number(trPnl.entry_price)) * Number(eEx.quantity), 0)
      }, 0)
      return {
        id:           subRow.id,
        email:        subRow.email,
        full_name:    subRow.full_name,
        avatar_url:   subRow.avatar_url,
        created_at:   subRow.created_at,
        status:       subRow.status,               // ← status in final response
        totalTrades:  userTradesArr.length,
        openTrades:   userTradesArr.filter(trO => trO.status === 'OPEN').length,
        closedTrades: userTradesArr.filter(trC => trC.status === 'CLOSED').length,
        totalInvestment,
        realisedPnL,
        isAdmin:      subRow.email === ADMIN_EMAIL,
      }
    })

    return res.status(200).json(summary)
  } catch (catchErr) {
    return res.status(500).json({ error: catchErr.message })
  }
}
