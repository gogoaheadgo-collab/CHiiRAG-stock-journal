import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null
  return user
}

export default async function handler(req, res) {
  try {
    const admin = await verifyAdmin(req)
    if (!admin) return res.status(403).json({ error: 'Admin only' })

    // GET - list all viewers
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('allowed_viewers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    // POST - add new viewer
    if (req.method === 'POST') {
      const { email, name, assigned_portfolios } = req.body
      if (!email?.trim()) return res.status(400).json({ error: 'Email required' })

      const { data, error } = await supabase
        .from('allowed_viewers')
        .insert([{
          email: email.trim().toLowerCase(),
          name: name?.trim() || null,
          assigned_portfolios: assigned_portfolios || [],
        }])
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    // PUT - update viewer portfolios
    if (req.method === 'PUT') {
      const { id, email, name, assigned_portfolios } = req.body
      if (!id) return res.status(400).json({ error: 'ID required' })

      const { data, error } = await supabase
        .from('allowed_viewers')
        .update({
          email: email?.trim().toLowerCase(),
          name: name?.trim() || null,
          assigned_portfolios: assigned_portfolios || [],
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    // DELETE - remove viewer
    if (req.method === 'DELETE') {
      const { id } = req.body
      if (!id) return res.status(400).json({ error: 'ID required' })

      const { error } = await supabase
        .from('allowed_viewers')
        .delete()
        .eq('id', id)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
