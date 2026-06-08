import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { setCors } from '../../lib/cors'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const CRON_SECRET = process.env.CRON_SECRET || 'chiirag-alerts-secret'

const NSE_HOLIDAYS = new Set([
  '2025-01-26','2025-03-14','2025-04-14','2025-04-18','2025-05-01',
  '2025-08-15','2025-10-02','2025-10-20','2025-10-21','2025-11-05','2025-12-25',
  '2026-01-26','2026-03-13','2026-04-02','2026-04-14','2026-05-01',
  '2026-06-16','2026-08-15','2026-10-02','2026-10-19','2026-11-09','2026-12-25',
])

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function isNonTradingDay(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  return dow === 0 || dow === 6 || NSE_HOLIDAYS.has(dateStr)
}

function getNotifyDate(resultDateStr) {
  const dayBefore = addDays(resultDateStr, -1)
  return isNonTradingDay(dayBefore) ? addDays(resultDateStr, -2) : dayBefore
}

function buildEmailHTML(results) {
  const byDate = {}
  results.forEach(r => { if (!byDate[r.result_date]) byDate[r.result_date] = []; byDate[r.result_date].push(r) })

  const sections = Object.entries(byDate).map(([date, items]) => {
    const fmtDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    const rows = items.map(r => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #1e293b;">
          <div style="font-family:monospace;font-weight:800;font-size:15px;color:#e2e8f0;">${r.ticker}</div>
          ${r.stock_name && r.stock_name !== r.ticker ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${r.stock_name}</div>` : ''}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e293b;text-align:right;">
          <div style="display:inline-block;background:#7c3aed;color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">📊 RESULTS</div>
        </td>
      </tr>`).join('')
    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;text-align:center;">📅 ${fmtDate}</div>
        <table style="width:100%;border-collapse:collapse;background:#0f0f0f;border-radius:8px;overflow:hidden;">${rows}</table>
      </div>`
  }).join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:monospace;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:16px;font-weight:800;color:#e2e8f0;">SMK STOCK Journal</div>
      <div style="font-size:11px;color:#64748b;letter-spacing:0.15em;margin-top:4px;">RESULTS ANNOUNCEMENT REMINDER</div>
    </div>
    <div style="background:#1a1a2e;border:2px solid #7c3aed;border-radius:12px;padding:24px;margin-bottom:16px;">
      ${sections}
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://smk-stock-journal.vercel.app/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;">View Dashboard →</a>
    </div>
    <div style="text-align:center;font-size:10px;color:#374151;">
      SMK Stock Journal · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
    </div>
  </div></body></html>`
}

async function sendEmail(to, subject, html) {
  const t = nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD } })
  await t.sendMail({ from:`"SMK Stock Journal" <${process.env.GMAIL_USER}>`, to, subject, html })
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const secret = req.headers['x-cron-secret'] || req.query.secret || req.headers['authorization']?.replace('Bearer ','')
  if (secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const todayStr = new Date().toISOString().slice(0, 10)

    // Fetch results for next 7 days, find ones whose notify date = today
    const { data: upcoming } = await adminSupabase
      .from('result_announcements')
      .select('*')
      .gte('result_date', addDays(todayStr, 1))
      .lte('result_date', addDays(todayStr, 7))
      .order('result_date', { ascending: true })

    const toNotify = (upcoming || []).filter(r => getNotifyDate(r.result_date) === todayStr)
    if (!toNotify.length) return res.status(200).json({ sent: 0, message: 'No reminders due today' })

    // Get all user emails
    const { data: { users } } = await adminSupabase.auth.admin.listUsers()
    const emails = (users || []).map(u => u.email).filter(Boolean)
    if (!emails.length) return res.status(200).json({ sent: 0, message: 'No subscribers' })

    const tickers = toNotify.map(r => r.ticker).join(', ')
    const subject = `📊 Results Tomorrow: ${tickers}`
    const html = buildEmailHTML(toNotify)

    let sent = 0
    for (const email of emails) {
      try { await sendEmail(email, subject, html); sent++ }
      catch (e) { console.error(`Email failed for ${email}:`, e.message) }
    }

    return res.status(200).json({ sent, notified: toNotify.length })
  } catch (err) {
    console.error('cron-result-reminder:', err)
    return res.status(500).json({ error: err.message })
  }
}
