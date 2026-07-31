import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'
import { fetchDailyBars } from '../../lib/priceHistory'
import { updateMfeMaeForTrade } from '../../lib/updateTradeMfeMae'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const CRON_SECRET = process.env.CRON_SECRET || 'chiirag-alerts-secret'

function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const secret = req.headers['x-cron-secret'] || req.query.secret || req.headers['authorization']?.replace('Bearer ','')
  if (secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const today = todayIST()
    const sevenDaysAgo = addDays(today, -7)

    // Step 1: distinct tickers among open trades
    const { data: openTrades, error: tradesError } = await adminSupabase
      .from('trades')
      .select('ticker')
      .eq('status', 'OPEN')
    if (tradesError) throw tradesError

    const tickers = [...new Set((openTrades || []).map(t => t.ticker).filter(Boolean))]

    // Step 2: catch up price_history for each ticker (sequential, rate-limit friendly)
    const tickersUpdated = []
    const errors = []
    for (const ticker of tickers) {
      try {
        const bars = await fetchDailyBars(ticker, sevenDaysAgo, today)
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
          const { error: upsertError } = await adminSupabase
            .from('price_history')
            .upsert(rows, { onConflict: 'ticker,date' })
          if (upsertError) throw upsertError
        }
        tickersUpdated.push(ticker)
      } catch (e) {
        errors.push({ ticker, error: e.message })
      }
      await new Promise(r => setTimeout(r, 300))
    }

    // Step 3: recalculate MFE/MAE for all open trades (DB-only, safe to parallelize)
    const { data: openIds, error: idsError } = await adminSupabase
      .from('trades')
      .select('id')
      .eq('status', 'OPEN')
    if (idsError) throw idsError

    await Promise.all((openIds || []).map(t => updateMfeMaeForTrade(adminSupabase, t.id)))

    return res.status(200).json({
      tickersUpdated,
      tradesRecalculated: (openIds || []).length,
      errors,
    })
  } catch (err) {
    console.error('cron-update-mfe-mae:', err)
    return res.status(500).json({ error: err.message })
  }
}
