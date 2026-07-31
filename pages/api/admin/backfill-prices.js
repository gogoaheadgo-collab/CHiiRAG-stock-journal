import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../../lib/cors'
import { fetchDailyBars } from '../../../lib/priceHistory'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { data: trades, error } = await admin.from('trades').select('ticker, entry_date, exit_date')
  if (error) return res.status(500).json({ error: error.message })

  const today = todayIST()
  const ranges = {}
  for (const t of trades || []) {
    if (!t.ticker || !t.entry_date) continue
    const toDate = t.exit_date || today
    const existing = ranges[t.ticker]
    if (!existing) {
      ranges[t.ticker] = { from_date: t.entry_date, to_date: toDate }
    } else {
      if (t.entry_date < existing.from_date) existing.from_date = t.entry_date
      if (toDate > existing.to_date) existing.to_date = toDate
    }
  }

  const results = []
  for (const ticker of Object.keys(ranges)) {
    const { from_date, to_date } = ranges[ticker]
    try {
      const bars = await fetchDailyBars(ticker, from_date, to_date)
      const rows = bars.map(b => ({
        ticker,
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }))
      if (rows.length) {
        const { error: upsertError } = await admin
          .from('price_history')
          .upsert(rows, { onConflict: 'ticker,date' })
        if (upsertError) throw upsertError
      }
      results.push({ ticker, barsFetched: rows.length, error: null })
    } catch (e) {
      results.push({ ticker, barsFetched: 0, error: e.message })
    }
    await new Promise(r => setTimeout(r, 300))
  }

  return res.status(200).json(results)
}
