import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await adminSupabase
      .from('price_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { ticker, validity_months, above_tg1, above_tg2, below_tg1, below_tg2, note } = req.body
    if (!ticker) return res.status(400).json({ error: 'ticker required' })
    if (!above_tg1 && !above_tg2 && !below_tg1 && !below_tg2)
      return res.status(400).json({ error: 'At least one target price required' })

    const alert_date = new Date().toISOString().slice(0, 10)
    const valid_till = new Date()
    valid_till.setMonth(valid_till.getMonth() + Number(validity_months || 1))
    const valid_till_str = valid_till.toISOString().slice(0, 10)

    const { data, error } = await adminSupabase.from('price_alerts').insert([{
      user_id: user.id,
      user_email: user.email,
      ticker: ticker.toUpperCase(),
      validity_months: Number(validity_months || 1),
      alert_date,
      valid_till: valid_till_str,
      above_tg1: above_tg1 ? Number(above_tg1) : null,
      above_tg2: above_tg2 ? Number(above_tg2) : null,
      below_tg1: below_tg1 ? Number(below_tg1) : null,
      below_tg2: below_tg2 ? Number(below_tg2) : null,
      note: note || null,
      status: 'ACTIVE',
      triggered_targets: [],
    }]).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, status } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await adminSupabase.from('price_alerts').update({ status }).eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await adminSupabase.from('price_alerts').delete().eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
