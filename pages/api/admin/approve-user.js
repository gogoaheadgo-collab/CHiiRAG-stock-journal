import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { setCors } from '../../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { user_id, status } = req.body
  if (!user_id || !status) return res.status(400).json({ error: 'user_id and status required' })

  const { error } = await admin.from('profiles').update({ status }).eq('id', user_id)
  if (error) return res.status(500).json({ error: error.message })

  try {
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', user_id).single()
    if (profile?.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      })
      const isApproved = status === 'approved'
      await transporter.sendMail({
        from: `"SMK Stock Journal" <${process.env.GMAIL_USER}>`,
        to: profile.email,
        subject: isApproved ? '✅ Access Approved — SMK Stock Journal' : '❌ Access Request Declined',
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0f0f;font-family:monospace;">
          <div style="max-width:480px;margin:0 auto;padding:32px 16px;text-align:center;">
            <div style="font-size:16px;font-weight:800;color:#e2e8f0;margin-bottom:8px;">SMK STOCK Journal</div>
            <div style="font-size:40px;margin:20px 0;">${isApproved ? '✅' : '❌'}</div>
            <div style="font-size:20px;font-weight:700;color:${isApproved ? '#22c55e' : '#ef4444'};margin-bottom:12px;">
              ${isApproved ? 'Access Approved!' : 'Access Declined'}
            </div>
            <div style="color:#94a3b8;font-size:13px;margin-bottom:24px;">
              Hi ${profile.full_name || 'there'},<br/><br/>
              ${isApproved
                ? 'Your access to SMK Stock Journal has been approved. You can now log in and start using the portal.'
                : 'Your access request has been declined. Please contact the admin for more information.'}
            </div>
            ${isApproved ? `<a href="https://smk-stock-journal.vercel.app" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;">Login Now →</a>` : ''}
          </div></body></html>`
      })
    }
  } catch (e) { console.error('Email error:', e.message) }

  return res.status(200).json({ success: true })
}
