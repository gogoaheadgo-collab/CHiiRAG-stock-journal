import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Service role needed to delete executions (RLS disabled but safer with service role)
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
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
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
    const { data, error } = await supabase
      .from('accounts').insert([{ user_id: user.id, name: name.trim().toUpperCase() }]).select().single()
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

    // 1. Get account name so we can find its trades
    let accountName = name
    if (!accountName) {
      const { data: acc } = await supabase.from('accounts').select('name').eq('id', id).single()
      accountName = acc?.name
    }

    if (accountName) {
      // 2. Get all trade IDs belonging to this account for this user
      const { data: trades } = await supabase
        .from('trades').select('id').eq('user_id', user.id).eq('account', accountName)

      if (trades?.length) {
        const tradeIds = trades.map(t => t.id)

        // 3. Delete all executions for these trades
        await adminSupabase.from('executions').delete().in('trade_id', tradeIds)

        // 4. Delete all trades for this account
        await supabase.from('trades').delete().eq('user_id', user.id).eq('account', accountName)
      }
    }

    // 5. Delete the account record itself
    const { error } = await supabase.from('accounts').delete().eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
