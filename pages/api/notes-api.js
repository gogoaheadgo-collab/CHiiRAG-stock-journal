import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // GET — fetch notes for user (optionally filter by date or search)
  if (req.method === 'GET') {
    const { date, search } = req.query
    let query = adminSupabase.from('notes').select('*').eq('user_id', user.id)
    if (date) query = query.eq('note_date', date)
    if (search) query = query.ilike('content', `%${search}%`)
    const { data, error } = await query.order('note_date', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // POST — create or update note for a date (upsert by user_id + note_date)
  if (req.method === 'POST') {
    const { note_date, content, stock_ticker, stock_data, image_urls } = req.body
    if (!note_date) return res.status(400).json({ error: 'note_date required' })

    // Check if note exists for this date
    const { data: existing } = await adminSupabase
      .from('notes').select('id').eq('user_id', user.id).eq('note_date', note_date).single()

    let result
    if (existing) {
      const { data, error } = await adminSupabase.from('notes').update({
        content: content || null,
        stock_ticker: stock_ticker || null,
        stock_data: stock_data || null,
        image_urls: image_urls || [],
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).select().single()
      if (error) return res.status(500).json({ error: error.message })
      result = data
    } else {
      const { data, error } = await adminSupabase.from('notes').insert([{
        user_id: user.id,
        note_date,
        content: content || null,
        stock_ticker: stock_ticker || null,
        stock_data: stock_data || null,
        image_urls: image_urls || [],
      }]).select().single()
      if (error) return res.status(500).json({ error: error.message })
      result = data
    }
    return res.status(200).json(result)
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await adminSupabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
