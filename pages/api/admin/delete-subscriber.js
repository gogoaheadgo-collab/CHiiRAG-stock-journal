import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  if (user_id === user.id) return res.status(400).json({ error: 'Cannot delete yourself' })

  try {
    const { data: trades } = await admin.from('trades').select('id').eq('user_id', user_id)
    const tradeIds = (trades || []).map(t => t.id)
    if (tradeIds.length > 0) await admin.from('executions').delete().in('trade_id', tradeIds)

    await admin.from('trades').delete().eq('user_id', user_id)
    await admin.from('accounts').delete().eq('user_id', user_id)
    await admin.from('mirrored_accounts').delete().eq('subscriber_id', user_id)
    await admin.from('shared_accounts').delete().eq('subscriber_id', user_id)
    await admin.from('price_alerts').delete().eq('user_id', user_id)
    await admin.from('notes').delete().eq('user_id', user_id)
    await admin.from('settlements').delete().eq('subscriber_id', user_id)
    await admin.from('profiles').delete().eq('id', user_id)
    await admin.auth.admin.deleteUser(user_id)

    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
