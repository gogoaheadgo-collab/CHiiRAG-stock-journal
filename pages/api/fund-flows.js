import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { account, year } = req.query
    let query = supabase
      .from('fund_flows')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    // account omitted → all of this user's flows across every account (used for the "All Accounts" aggregate view)
    if (account) query = query.eq('account_name', account)
    if (year) query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { account_name, date, amount, type } = req.body
    if (!account_name || !date || !amount || !type)
      return res.status(400).json({ error: `Missing fields: account_name=${account_name} date=${date} amount=${amount} type=${type}` })
    if (!['ADD', 'WITHDRAW'].includes(type)) return res.status(400).json({ error: 'Invalid type' })
    const { data, error } = await supabase
      .from('fund_flows')
      .insert([{ user_id: user.id, account_name, date, amount: Number(amount), type }])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })
    const { error } = await supabase
      .from('fund_flows')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
