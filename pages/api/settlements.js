import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // GET — fetch settlements for a subscriber (admin or self)
  if (req.method === 'GET') {
    const { subscriber_id } = req.query
    if (!subscriber_id) return res.status(400).json({ error: 'subscriber_id required' })
    // Admin can fetch any; subscriber can only fetch their own
    if (user.email !== ADMIN_EMAIL && user.id !== subscriber_id)
      return res.status(403).json({ error: 'Forbidden' })
    const { data, error } = await adminSupabase
      .from('settlements').select('*').eq('subscriber_id', subscriber_id).order('date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // POST — add settlement (admin only)
  if (req.method === 'POST') {
    if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })
    const { subscriber_id, date, value, remarks } = req.body
    if (!subscriber_id || !date || value === undefined)
      return res.status(400).json({ error: 'subscriber_id, date, value required' })
    const { data, error } = await adminSupabase
      .from('settlements').insert([{ admin_id: user.id, subscriber_id, date, value: Number(value), remarks: remarks || null }]).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE — remove settlement (admin only)
  if (req.method === 'DELETE') {
    if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await adminSupabase.from('settlements').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // PUT — update settlement (admin only)
  if (req.method === 'PUT') {
    if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Admin only' })
    const { id, value, remarks } = req.body
    if (!id || value === undefined) return res.status(400).json({ error: 'id and value required' })
    const { data, error } = await adminSupabase
      .from('settlements').update({ value: Number(value), remarks: remarks || null }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
