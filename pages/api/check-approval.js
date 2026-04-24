import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

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
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (user.email === ADMIN_EMAIL) return res.status(200).json({ status: 'approved' })

  const { data: profile } = await admin
    .from('profiles').select('status').eq('id', user.id).maybeSingle()

  if (profile) {
    if (profile.status === 'rejected') {
      await admin.from('profiles').update({ status: 'pending' }).eq('id', user.id)
      return res.status(200).json({ status: 'requeued' })
    }
    return res.status(200).json({ status: profile.status || 'pending' })
  }

  await admin.from('profiles').insert([{
    id: user.id,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    email: user.email,
    status: 'pending',
  }])

  return res.status(200).json({ status: 'pending' })
}
