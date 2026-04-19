import { createClient } from '@supabase/supabase-js'

const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const svcClient  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ── Helper: recalculate all balance_after values for an account ──────────
async function recalcAccount(acctId) {
  const { data: acctRow } = await svcClient.from('bank_accounts').select('initial_balance').eq('id', acctId).single()
  const { data: txnRows }  = await svcClient.from('bank_transactions')
    .select('id, amount, transaction_type, transaction_date, created_at')
    .eq('account_id', acctId)
    .order('transaction_date', { ascending: true })
    .order('created_at',        { ascending: true })
  let bal = Number(acctRow?.initial_balance || 0)
  for (const txRow of (txnRows || [])) {
    bal = txRow.transaction_type === 'CREDIT' ? bal + Number(txRow.amount) : bal - Number(txRow.amount)
    await svcClient.from('bank_transactions').update({ balance_after: bal }).eq('id', txRow.id)
  }
  await svcClient.from('bank_accounts').update({ balance: bal }).eq('id', acctId)
  return bal
}

// ── Helper: find the partner transaction id for an A2A txn ───────────────
async function findPartnerTxnId(txn) {
  if (txn.partner_transaction_id) return txn.partner_transaction_id
  if (txn.source_type !== 'A2A_TRANSFER') return null
  const oppositeType = txn.transaction_type === 'CREDIT' ? 'DEBIT' : 'CREDIT'
  const { data: candidates } = await svcClient.from('bank_transactions')
    .select('id, account_id')
    .neq('account_id', txn.account_id)
    .eq('source_type', 'A2A_TRANSFER')
    .eq('transaction_date', txn.transaction_date)
    .eq('amount', txn.amount)
    .eq('transaction_type', oppositeType)
  if (candidates?.length === 1) return candidates[0].id
  return null
}

export default async function handler(req, res) {
  const bearerToken = req.headers.authorization?.replace('Bearer ', '')
  if (!bearerToken) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user: txnUser } } = await authClient.auth.getUser(bearerToken)
  if (!txnUser) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { account_id: getAcctId } = req.query
    if (!getAcctId) return res.status(400).json({ error: 'account_id required' })
    const { data: txnListData, error: txnListErr } = await svcClient
      .from('bank_transactions').select('*').eq('account_id', getAcctId)
      .order('transaction_date', { ascending: false })
    if (txnListErr) return res.status(500).json({ error: txnListErr.message })
    return res.status(200).json(txnListData || [])
  }

  if (req.method === 'POST') {
    const { account_id: postAcctId, transaction_date, transaction_type, source_type, source_detail, withdrawal_mode, amount, notes, a2a_partner_account_id } = req.body
    if (!postAcctId || !transaction_date || !transaction_type || !source_type || !amount)
      return res.status(400).json({ error: 'Required fields missing' })
    const { data: primaryAcct } = await svcClient.from('bank_accounts').select('balance, bank_name, holder_name').eq('id', postAcctId).single()
    if (!primaryAcct) return res.status(404).json({ error: 'Account not found' })
    const postAmt    = Number(amount)
    const isCredit   = transaction_type === 'CREDIT'
    const primaryBal = isCredit ? primaryAcct.balance + postAmt : primaryAcct.balance - postAmt
    const { data: primaryTxn, error: primaryErr } = await svcClient.from('bank_transactions').insert([{
      account_id: postAcctId, user_id: txnUser.id, transaction_date, transaction_type,
      source_type, source_detail: source_detail || null, withdrawal_mode: withdrawal_mode || null,
      amount: postAmt, balance_after: primaryBal, notes: notes || null, created_by: txnUser.id,
    }]).select().single()
    if (primaryErr) return res.status(500).json({ error: primaryErr.message })
    await svcClient.from('bank_accounts').update({ balance: primaryBal }).eq('id', postAcctId)

    if (source_type === 'A2A_TRANSFER' && a2a_partner_account_id) {
      const { data: partnerAcct } = await svcClient.from('bank_accounts').select('balance, bank_name, holder_name').eq('id', a2a_partner_account_id).single()
      if (partnerAcct) {
        const partnerType   = isCredit ? 'DEBIT' : 'CREDIT'
        const partnerBal    = partnerType === 'CREDIT' ? partnerAcct.balance + postAmt : partnerAcct.balance - postAmt
        const partnerDetail = `${primaryAcct.holder_name} (${primaryAcct.bank_name})`
        const { data: partnerTxn } = await svcClient.from('bank_transactions').insert([{
          account_id: a2a_partner_account_id, user_id: txnUser.id, transaction_date,
          transaction_type: partnerType, source_type: 'A2A_TRANSFER',
          source_detail: partnerDetail, amount: postAmt, balance_after: partnerBal,
          notes: notes || null, created_by: txnUser.id,
        }]).select().single()
        if (partnerTxn) {
          await svcClient.from('bank_transactions').update({ partner_transaction_id: partnerTxn.id }).eq('id', primaryTxn.id)
          await svcClient.from('bank_transactions').update({ partner_transaction_id: primaryTxn.id }).eq('id', partnerTxn.id)
        }
        await svcClient.from('bank_accounts').update({ balance: partnerBal }).eq('id', a2a_partner_account_id)
      }
    }
    return res.status(200).json(primaryTxn)
  }

  if (req.method === 'PUT') {
    const { id: putId, transaction_date, transaction_type, source_type, source_detail, withdrawal_mode, amount, notes } = req.body
    if (!putId) return res.status(400).json({ error: 'id required' })
    const { data: currentTxn } = await svcClient.from('bank_transactions').select('*').eq('id', putId).single()
    if (!currentTxn) return res.status(404).json({ error: 'Transaction not found' })
    const { error: putErr } = await svcClient.from('bank_transactions').update({
      transaction_date, transaction_type, source_type,
      source_detail: source_detail || null, withdrawal_mode: withdrawal_mode || null,
      amount: Number(amount), notes: notes || null,
    }).eq('id', putId)
    if (putErr) return res.status(500).json({ error: putErr.message })
    await recalcAccount(currentTxn.account_id)

    if (currentTxn.source_type === 'A2A_TRANSFER') {
      const partnerTxnId = await findPartnerTxnId(currentTxn)
      if (partnerTxnId) {
        const { data: partnerTxnRow } = await svcClient.from('bank_transactions').select('account_id').eq('id', partnerTxnId).single()
        const partnerType = transaction_type === 'CREDIT' ? 'DEBIT' : 'CREDIT'
        await svcClient.from('bank_transactions').update({
          transaction_date, transaction_type: partnerType, amount: Number(amount), notes: notes || null,
        }).eq('id', partnerTxnId)
        await recalcAccount(partnerTxnRow.account_id)
      }
    }
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id: delId } = req.body
    if (!delId) return res.status(400).json({ error: 'id required' })
    const { data: delTxn } = await svcClient.from('bank_transactions').select('*').eq('id', delId).single()
    if (!delTxn) return res.status(404).json({ error: 'Transaction not found' })
    const partnerTxnId = await findPartnerTxnId(delTxn)
    let partnerAcctId = null
    if (partnerTxnId) {
      const { data: partnerRow } = await svcClient.from('bank_transactions').select('account_id').eq('id', partnerTxnId).single()
      partnerAcctId = partnerRow?.account_id
    }
    await svcClient.from('bank_transactions').delete().eq('id', delId)
    if (partnerTxnId) await svcClient.from('bank_transactions').delete().eq('id', partnerTxnId)
    await recalcAccount(delTxn.account_id)
    if (partnerAcctId) await recalcAccount(partnerAcctId)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
