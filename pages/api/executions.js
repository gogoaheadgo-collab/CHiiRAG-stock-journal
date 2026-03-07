import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { trade_id } = req.query
    if (!trade_id) return res.status(400).json({ error: 'trade_id required' })
    const { data, error } = await supabase
      .from('executions')
      .select('*')
      .eq('trade_id', trade_id)
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { trade_id, type, quantity, price, date, actual_investment } = req.body
    if (!trade_id || !type || !quantity || !price || !date)
      return res.status(400).json({ error: `Missing fields: trade_id=${trade_id} type=${type} qty=${quantity} price=${price} date=${date}` })
    const { data, error } = await supabase
      .from('executions')
      .insert([{ trade_id, type, quantity, price, date, actual_investment: actual_investment || null, user_id: user.id }])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })
    const { error } = await supabase
      .from('executions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
