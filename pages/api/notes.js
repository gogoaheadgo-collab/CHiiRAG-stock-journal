import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
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
    const { date, search, shared } = req.query

    if (shared === '1') {
      const { data, error } = await admin
        .from('notes').select('*').eq('is_shared', true)
        .order('note_date', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data || [])
    }

    let q = admin.from('notes').select('*').eq('user_id', user.id)
    if (date) q = q.eq('note_date', date)
    if (search) q = q.ilike('content', `%${search}%`)
    const { data, error } = await q.order('note_date', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { note_date, content, tickers, image_urls } = req.body
    if (!note_date) return res.status(400).json({ error: 'note_date required' })

    const { data: existing } = await admin
      .from('notes').select('id, is_shared').eq('user_id', user.id).eq('note_date', note_date).limit(1)

    const payload = {
      content: content ?? '',
      tickers: tickers || [],
      image_urls: image_urls || [],
      updated_at: new Date().toISOString(),
    }

    let result, err
    if (existing && existing.length > 0) {
      const r = await admin.from('notes').update(payload).eq('id', existing[0].id).select().single()
      result = r.data; err = r.error
    } else {
      const r = await admin.from('notes').insert([{
        user_id: user.id, note_date, is_shared: false, shared_by: null, ...payload
      }]).select().single()
      result = r.data; err = r.error
    }

    if (err) return res.status(500).json({ error: err.message })
    return res.status(200).json(result)
  }

  if (req.method === 'PUT') {
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' })
    const { note_date, is_shared } = req.body
    if (!note_date) return res.status(400).json({ error: 'note_date required' })

    const { data: existing } = await admin
      .from('notes').select('id').eq('user_id', user.id).eq('note_date', note_date).limit(1)

    if (!existing || existing.length === 0)
      return res.status(404).json({ error: 'Note not found — save the note first before sharing' })

    const { data, error } = await admin.from('notes').update({
      is_shared: Boolean(is_shared),
      shared_by: is_shared ? user.id : null,
    }).eq('id', existing[0].id).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await admin.from('notes').delete().eq('id', id).eq('user_id', user.id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
