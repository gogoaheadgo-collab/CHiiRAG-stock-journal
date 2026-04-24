import { createClient } from '@supabase/supabase-js'
import { setCors } from '../../lib/cors'

const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const svcClient  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const bearerToken = req.headers.authorization?.replace('Bearer ', '')
  if (!bearerToken) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user: acctUser } } = await authClient.auth.getUser(bearerToken)
  if (!acctUser) return res.status(401).json({ error: 'Unauthorized' })
  const acctIsAdmin = acctUser.email === ADMIN_EMAIL

  if (req.method === 'GET') {
    const queryUid = req.query.user_id || acctUser.id
    if (queryUid !== acctUser.id && !acctIsAdmin) return res.status(403).json({ error: 'Forbidden' })
    const { data: acctListData, error: acctListErr } = await svcClient
      .from('bank_accounts').select('*').eq('user_id', queryUid).order('created_at', { ascending: true })
    if (acctListErr) return res.status(500).json({ error: acctListErr.message })
    return res.status(200).json(acctListData || [])
  }

  if (req.method === 'POST') {
    const { bank_name, holder_name, balance, user_id: bodyUid } = req.body
    if (!bank_name || !holder_name) return res.status(400).json({ error: 'bank_name and holder_name required' })
    const insertUid = (acctIsAdmin && bodyUid) ? bodyUid : acctUser.id
    const initBal = Number(balance) || 0
    const { data: insertData, error: insertErr } = await svcClient
      .from('bank_accounts')
      .insert([{ user_id: insertUid, bank_name: bank_name.trim(), holder_name: holder_name.trim(), initial_balance: initBal, balance: initBal }])
      .select().single()
    if (insertErr) return res.status(500).json({ error: insertErr.message })
    return res.status(200).json(insertData)
  }

  if (req.method === 'PUT') {
    const { id: updateId, bank_name: updBankName, holder_name: updHolderName } = req.body
    if (!updateId) return res.status(400).json({ error: 'id required' })
    const updateFields = {}
    if (updBankName !== undefined) updateFields.bank_name = updBankName.trim()
    if (updHolderName !== undefined) updateFields.holder_name = updHolderName.trim()
    const { data: updData, error: updErr } = await svcClient
      .from('bank_accounts').update(updateFields).eq('id', updateId).select().single()
    if (updErr) return res.status(500).json({ error: updErr.message })
    return res.status(200).json(updData)
  }

  if (req.method === 'DELETE') {
    const { id: delAcctId } = req.body
    if (!delAcctId) return res.status(400).json({ error: 'id required' })
    await svcClient.from('bank_transactions').delete().eq('account_id', delAcctId)
    const { error: delAcctErr } = await svcClient.from('bank_accounts').delete().eq('id', delAcctId)
    if (delAcctErr) return res.status(500).json({ error: delAcctErr.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
