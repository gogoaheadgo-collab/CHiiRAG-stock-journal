import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'No token' })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError) {
      return res.status(401).json({ error: 'Auth failed', detail: authError.message })
    }

    if (!user) {
      return res.status(401).json({ error: 'No user found' })
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const { name } = req.body
      if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
      const { data, error } = await supabase
        .from('accounts')
        .insert([{ user_id: user.id, name: name.trim().toUpperCase() }])
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const { id } = req.body
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack })
  }
}