import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const CRON_SECRET = process.env.CRON_SECRET || 'chiirag-alerts-secret'

async function fetchPrice(ticker) {
  for (const sym of [`${ticker}.NS`, `${ticker}.BO`]) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1m&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      })
      const d = await r.json()
      const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price) return price
    } catch {}
  }
  return null
}

function emailHTML(alert, cmp, triggered) {
  const fmt = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const rows = triggered.map(t => `
    <tr>
      <td style="padding:8px 12px;color:${t.isAbove ? '#22c55e' : '#ef4444'};font-weight:700;">${t.isAbove ? '↑ ABOVE' : '↓ BELOW'} TG${t.level}</td>
      <td style="padding:8px 12px;color:#e2e8f0;">Rs${fmt(t.target)}</td>
      <td style="padding:8px 12px;color:${t.isAbove ? '#22c55e' : '#ef4444'};font-weight:700;">Rs${fmt(cmp)}</td>
    </tr>`).join('')
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:monospace;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:16px;font-weight:800;color:#e2e8f0;">SMK STOCK Journal</div>
      <div style="font-size:11px;color:#64748b;letter-spacing:0.15em;margin-top:4px;">PRICE ALERT TRIGGERED</div>
    </div>
    <div style="background:#1a1a2e;border:2px solid #0ea5e9;border-radius:12px;padding:24px;margin-bottom:16px;">
      <div style="font-size:26px;font-weight:800;color:#e2e8f0;text-align:center;margin-bottom:16px;">${alert.ticker}</div>
      <div style="background:#0f0f0f;border-radius:8px;padding:10px 14px;text-align:center;margin-bottom:16px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">CURRENT PRICE</div>
        <div style="font-size:24px;font-weight:800;color:#0ea5e9;">Rs${fmt(cmp)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#0f0f0f;">
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#64748b;letter-spacing:0.1em;">TARGET</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#64748b;letter-spacing:0.1em;">PRICE</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;color:#64748b;letter-spacing:0.1em;">CMP</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${alert.note ? `<div style="margin-top:12px;font-size:12px;color:#94a3b8;">📝 ${alert.note}</div>` : ''}
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://smk-stock-journal.vercel.app/alerts" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;">View Alerts →</a>
    </div>
    <div style="text-align:center;font-size:10px;color:#374151;">
      SMK Stock Journal · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
    </div>
  </div></body></html>`
}

async function sendEmail(to, subject, html) {
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
  await t.sendMail({ from: `"SMK Stock Journal" <${process.env.GMAIL_USER}>`, to, subject, html })
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const today = new Date().toISOString().slice(0, 10)
  const { data: alerts } = await adminSupabase.from('price_alerts').select('*').eq('status', 'ACTIVE').gte('valid_till', today)
  if (!alerts?.length) return res.status(200).json({ checked: 0, triggered: 0 })

  const tickers = [...new Set(alerts.map(a => a.ticker))]
  const priceMap = {}
  await Promise.all(tickers.map(async t => { const p = await fetchPrice(t); if (p) priceMap[t] = p }))

  let triggered = 0
  for (const alert of alerts) {
    const cmp = priceMap[alert.ticker]
    if (!cmp) continue

    const already = alert.triggered_targets || []
    const newTriggered = []

    const checks = [
      { key: 'above_tg1', isAbove: true,  level: 1, target: alert.above_tg1 },
      { key: 'above_tg2', isAbove: true,  level: 2, target: alert.above_tg2 },
      { key: 'below_tg1', isAbove: false, level: 1, target: alert.below_tg1 },
      { key: 'below_tg2', isAbove: false, level: 2, target: alert.below_tg2 },
    ]

    for (const c of checks) {
      if (!c.target) continue
      if (already.includes(c.key)) continue
      const hit = c.isAbove ? cmp >= c.target : cmp <= c.target
      if (hit) newTriggered.push(c)
    }

    if (newTriggered.length > 0) {
      const allTriggered = [...already, ...newTriggered.map(t => t.key)]
      const allTargets = ['above_tg1','above_tg2','below_tg1','below_tg2'].filter(k => alert[k])
      const allDone = allTargets.every(k => allTriggered.includes(k))

      await adminSupabase.from('price_alerts').update({
        triggered_targets: allTriggered,
        status: allDone ? 'TRIGGERED' : 'ACTIVE',
        triggered_at: new Date().toISOString(),
        triggered_price: cmp,
      }).eq('id', alert.id)

      const subject = `🔔 ${alert.ticker} — ${newTriggered.length} target(s) hit — SMK Alert`
      try { await sendEmail(alert.user_email, subject, emailHTML(alert, cmp, newTriggered)) } catch (e) { console.error(e.message) }
      triggered++
    }
  }

  // ── Also check stop losses from open trades ──
  const { data: slTrades } = await adminSupabase
    .from('trades').select('id,user_id,ticker,entry_price,stop_loss,status,account')
    .eq('status', 'OPEN').not('stop_loss', 'is', null)

  let slTriggered = 0
  if (slTrades?.length) {
    const { data: usersData } = await adminSupabase.auth.admin.listUsers()
    const emailMap = {}
    usersData?.users?.forEach(u => { emailMap[u.id] = u.email })

    for (const trade of slTrades) {
      const cmp = priceMap[trade.ticker] || (await fetchPrice(trade.ticker))
      if (!cmp || cmp > trade.stop_loss) continue
      const email = emailMap[trade.user_id]
      if (!email) continue
      const slPct = ((trade.stop_loss - trade.entry_price) / trade.entry_price * 100).toFixed(2)
      const fmt = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })
      const subject = `🚨 STOP LOSS HIT: ${trade.ticker} at Rs${fmt(cmp)} — SMK Alert`
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:monospace;">
        <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:16px;font-weight:800;color:#e2e8f0;">SMK STOCK Journal</div>
            <div style="font-size:11px;color:#ef4444;letter-spacing:0.15em;margin-top:4px;">🚨 STOP LOSS TRIGGERED</div>
          </div>
          <div style="background:#1a1a2e;border:2px solid #ef4444;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">${trade.ticker}</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">Account: ${trade.account || 'N/A'}</div>
            <div style="display:flex;justify-content:space-around;gap:12px;">
              <div style="background:#0f0f0f;border-radius:8px;padding:12px;flex:1;">
                <div style="font-size:10px;color:#64748b;margin-bottom:4px;">BUY PRICE</div>
                <div style="font-size:16px;font-weight:700;color:#94a3b8;">Rs${fmt(trade.entry_price)}</div>
              </div>
              <div style="background:#0f0f0f;border-radius:8px;padding:12px;flex:1;border:1px solid #ef4444;">
                <div style="font-size:10px;color:#64748b;margin-bottom:4px;">STOP LOSS</div>
                <div style="font-size:16px;font-weight:700;color:#ef4444;">Rs${fmt(trade.stop_loss)}</div>
                <div style="font-size:10px;color:#ef4444;margin-top:2px;">${slPct}%</div>
              </div>
              <div style="background:#0f0f0f;border-radius:8px;padding:12px;flex:1;">
                <div style="font-size:10px;color:#64748b;margin-bottom:4px;">CMP</div>
                <div style="font-size:16px;font-weight:700;color:#ef4444;">Rs${fmt(cmp)}</div>
              </div>
            </div>
          </div>
          <div style="text-align:center;margin-bottom:16px;">
            <a href="https://smk-stock-journal.vercel.app/accounts" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;">View Trade →</a>
          </div>
          <div style="text-align:center;font-size:10px;color:#374151;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
        </div></body></html>`
      try { await sendEmail(email, subject, html) } catch(e) { console.error(e.message) }
      slTriggered++
    }
  }

  return res.status(200).json({ checked: alerts.length, triggered, slTriggered })
}
