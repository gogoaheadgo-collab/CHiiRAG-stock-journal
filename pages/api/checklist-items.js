import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { strategy } = req.query
    if (strategy) {
      const { data } = await supabase
        .from('checklist_items')
        .select('id, strategy_name, item_text, sort_order')
        .eq('strategy_name', strategy)
        .order('sort_order')
      return res.json(Array.isArray(data) ? data : [])
    }
    const { data } = await supabase
      .from('checklist_items')
      .select('id, strategy_name, item_text, sort_order')
      .order('sort_order')
    const grouped = {}
    ;(data || []).forEach(item => {
      if (!grouped[item.strategy_name]) grouped[item.strategy_name] = []
      grouped[item.strategy_name].push(item)
    })
    return res.json(grouped)
  }

  if (user.email !== ADMIN) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'POST') {
    const { strategy_name, item_text } = req.body
    if (!strategy_name?.trim()) return res.status(400).json({ error: 'Strategy name required' })
    if (!item_text?.trim()) return res.status(400).json({ error: 'Item text required' })
    const { error } = await supabase.from('checklist_items').insert([{
      strategy_name: strategy_name.trim().toUpperCase(),
      item_text: item_text.trim(),
    }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID required' })
    await supabase.from('checklist_items').delete().eq('id', id)
    return res.json({ ok: true })
  }

  res.status(405).end()
}
