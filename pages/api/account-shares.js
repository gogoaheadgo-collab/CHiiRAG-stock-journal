import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await auth.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const isAdmin = user.email === ADMIN_EMAIL

  if (req.method === 'GET') {
    if (isAdmin) {
      const { data, error } = await admin.from('shared_accounts')
        .select('*').eq('admin_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data || [])
    } else {
      const { data, error } = await admin.from('shared_accounts')
        .select('*').eq('subscriber_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data || [])
    }
  }

  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' })
    const { account_name, subscriber_id } = req.body
    if (!account_name || !subscriber_id) return res.status(400).json({ error: 'account_name and subscriber_id required' })

    const { data: { users } } = await admin.auth.admin.listUsers()
    const sub = users?.find(u => u.id === subscriber_id)

    const { data, error } = await admin.from('shared_accounts').upsert([{
      admin_id: user.id,
      account_name,
      subscriber_id,
      subscriber_email: sub?.email || null,
    }], { onConflict: 'admin_id,account_name,subscriber_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' })
    const { account_name, subscriber_id } = req.body
    if (!account_name || !subscriber_id) return res.status(400).json({ error: 'account_name and subscriber_id required' })

    const { error } = await admin.from('shared_accounts').delete()
      .eq('admin_id', user.id)
      .eq('account_name', account_name)
      .eq('subscriber_id', subscriber_id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
