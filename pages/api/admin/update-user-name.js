import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(token)
  if (authErr || !user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' })

  const { userId, name } = req.body
  if (!userId || !name?.trim()) return res.status(400).json({ error: 'userId and name are required' })

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: name.trim() })
    .eq('id', userId)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}
