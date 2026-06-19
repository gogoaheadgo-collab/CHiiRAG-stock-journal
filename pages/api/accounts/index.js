import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../../lib/cors'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('accounts').select('*').eq('user_id', user.id).order('name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { name, available_fund } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabase
      .from('accounts').insert([{ user_id: user.id, name: name.trim().toUpperCase(), available_fund: Number(available_fund) || 0 }]).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, add_amount } = req.body
    if (!id || !add_amount) return res.status(400).json({ error: 'ID and add_amount required' })
    const { data: existing } = await supabase.from('accounts').select('available_fund').eq('id', id).eq('user_id', user.id).single()
    const newFund = (Number(existing?.available_fund) || 0) + Number(add_amount)
    const { data, error } = await supabase.from('accounts').update({ available_fund: newFund }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, name } = req.body
    if (!id || !name?.trim()) return res.status(400).json({ error: 'ID and name required' })
    const { data, error } = await supabase
      .from('accounts').update({ name: name.trim().toUpperCase() }).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id, name } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })

    let accountName = name
    if (!accountName) {
      const { data: acc } = await supabase.from('accounts').select('name').eq('id', id).single()
      accountName = acc?.name
    }

    if (accountName) {
      const { data: trades } = await supabase
        .from('trades').select('id').eq('user_id', user.id).eq('account', accountName)
      if (trades?.length) {
        const tradeIds = trades.map(t => t.id)
        await adminSupabase.from('executions').delete().in('trade_id', tradeIds)
        await supabase.from('trades').delete().eq('user_id', user.id).eq('account', accountName)
      }
    }

    const { error } = await supabase.from('accounts').delete().eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
