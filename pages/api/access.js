import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No token' })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

    const email = user.email?.toLowerCase()

    if (email === ADMIN_EMAIL.toLowerCase()) {
      return res.status(200).json({ role: 'admin', portfolios: null })
    }

    const { data: viewer } = await supabase
      .from('allowed_viewers')
      .select('*')
      .eq('email', email)
      .single()

    if (!viewer) {
      return res.status(403).json({ role: 'denied', error: 'Access denied' })
    }

    return res.status(200).json({
      role: 'viewer',
      portfolios: viewer.assigned_portfolios || [],
      name: viewer.name,
    })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
