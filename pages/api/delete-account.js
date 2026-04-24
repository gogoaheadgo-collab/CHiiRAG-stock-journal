import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (user.email === ADMIN_EMAIL)
    return res.status(403).json({ error: 'Admin account cannot be deleted.' })

  try {
    const { data: trades } = await adminSupabase.from('trades').select('id').eq('user_id', user.id)
    const tradeIds = (trades || []).map(t => t.id)

    if (tradeIds.length > 0)
      await adminSupabase.from('executions').delete().in('trade_id', tradeIds)

    await adminSupabase.from('trades').delete().eq('user_id', user.id)
    await adminSupabase.from('accounts').delete().eq('user_id', user.id)
    await adminSupabase.from('mirrored_accounts').delete().eq('subscriber_id', user.id)
    await adminSupabase.from('profiles').delete().eq('id', user.id)

    const { error: delErr } = await adminSupabase.auth.admin.deleteUser(user.id)
    if (delErr) return res.status(500).json({ error: 'Could not delete auth user: ' + delErr.message })

    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
