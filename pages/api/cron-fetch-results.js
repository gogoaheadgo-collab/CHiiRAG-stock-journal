import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const CRON_SECRET = process.env.CRON_SECRET || 'chiirag-alerts-secret'

async function getNSECookies() {
  const res = await fetch('https://www.nseindia.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
    },
    redirect: 'follow'
  })
  const raw = res.headers.get('set-cookie') || ''
  return raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ')
}

async function fetchNSEEvents(cookies) {
  const res = await fetch('https://www.nseindia.com/api/event-calendar', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
      'Cookie': cookies,
      'X-Requested-With': 'XMLHttpRequest',
    }
  })
  if (!res.ok) throw new Error(`NSE API ${res.status}`)
  return await res.json()
}

function parseNSEDate(d) {
  if (!d) return null
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  // DD-Mon-YYYY e.g. "18-Apr-2026"
  const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
  const p = d.split('-')
  if (p.length === 3 && months[p[1]]) return `${p[2]}-${months[p[1]]}-${p[0].padStart(2,'0')}`
  // DD/MM/YYYY
  const s = d.split('/')
  if (s.length === 3) return `${s[2]}-${s[1].padStart(2,'0')}-${s[0].padStart(2,'0')}`
  return null
}

function getNSEDateField(e) {
  // Try all known NSE date field variants
  return e.bfMtngDate || e.bfMeetingDate || e.meetingDate || e.boardMeetingDate || e.date || e.eventDate || null
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const secret = req.headers['x-cron-secret'] || req.query.secret || req.headers['authorization']?.replace('Bearer ','')
  if (secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  try {
    // 1. Collect all tickers: open trades + notes
    const [tradesRes, notesRes] = await Promise.all([
      adminSupabase.from('trades').select('ticker').eq('status', 'OPEN'),
      adminSupabase.from('notes').select('tickers')
    ])

    const allTickers = new Set([
      ...(tradesRes.data || []).map(t => t.ticker.toUpperCase()),
      ...(notesRes.data || []).flatMap(n => (n.tickers || []).map(t => t.toUpperCase()))
    ])

    if (allTickers.size === 0) return res.status(200).json({ message: 'No tickers to track' })

    // 2. Fetch NSE event calendar with cookie auth
    const cookies = await getNSECookies()
    await new Promise(r => setTimeout(r, 1500)) // polite delay
    const events = await fetchNSEEvents(cookies)

    if (!Array.isArray(events)) throw new Error('NSE returned unexpected format')

    // 3. Filter: our tickers + financial results only + future dates
    const today = new Date().toISOString().slice(0, 10)
    const relevant = events.filter(e => {
      const sym = (e.symbol || '').toUpperCase()
      const purpose = (e.purpose || '').toLowerCase()
      const date = parseNSEDate(getNSEDateField(e))
      return allTickers.has(sym) &&
        (purpose.includes('result') || purpose.includes('financial')) &&
        date && date >= today
    })

    // Debug mode: return raw NSE events + your ticker set for comparison
    if (req.query.debug === '1') {
      return res.status(200).json({
        yourTickers: [...allTickers].sort(),
        nseEventSample: events.slice(0, 3).map(e => ({ ...e })),
        totalNseEvents: events.length,
      })
    }

    if (!relevant.length) return res.status(200).json({ scanned: events.length, matched: 0 })

    // 4. Upsert
    const rows = relevant.map(e => ({
      ticker: e.symbol.toUpperCase(),
      stock_name: e.company || e.symbol,
      result_date: parseNSEDate(getNSEDateField(e)),
    }))

    const { error } = await adminSupabase
      .from('result_announcements')
      .upsert(rows, { onConflict: 'ticker,result_date' })

    if (error) throw error

    return res.status(200).json({ scanned: events.length, matched: relevant.length, upserted: rows.length })
  } catch (err) {
    console.error('cron-fetch-results:', err)
    return res.status(500).json({ error: err.message })
  }
}
