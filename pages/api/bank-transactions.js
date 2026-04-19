import { createClient } from '@supabase/supabase-js'

const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const svcClient  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

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
    const { account_id: postAcctId, transaction_date, transaction_type, source_type, source_detail, withdrawal_mode, amount, notes } = req.body
    if (!postAcctId || !transaction_date || !transaction_type || !source_type || !amount)
      return res.status(400).json({ error: 'Required fields missing' })

    const { data: acctForBal } = await svcClient.from('bank_accounts').select('balance').eq('id', postAcctId).single()
    if (!acctForBal) return res.status(404).json({ error: 'Account not found' })

    const postAmtNum = Number(amount)
    const isPostCredit = transaction_type === 'CREDIT'
    const newBal = isPostCredit ? acctForBal.balance + postAmtNum : acctForBal.balance - postAmtNum

    const { data: newTxnData, error: newTxnErr } = await svcClient.from('bank_transactions').insert([{
      account_id:       postAcctId,
      user_id:          txnUser.id,
      transaction_date,
      transaction_type,
      source_type,
      source_detail:    source_detail || null,
      withdrawal_mode:  withdrawal_mode || null,
      amount:           postAmtNum,
      balance_after:    newBal,
      notes:            notes || null,
      created_by:       txnUser.id,
    }]).select().single()
    if (newTxnErr) return res.status(500).json({ error: newTxnErr.message })

    await svcClient.from('bank_accounts').update({ balance: newBal }).eq('id', postAcctId)
    return res.status(200).json(newTxnData)
  }

  if (req.method === 'PUT') {
    const { id: putTxnId, transaction_date, transaction_type, source_type, source_detail, withdrawal_mode, amount, notes } = req.body
    if (!putTxnId) return res.status(400).json({ error: 'id required' })

    // Update the transaction fields
    const { data: updatedTxn, error: putErr } = await svcClient.from('bank_transactions').update({
      transaction_date,
      transaction_type,
      source_type,
      source_detail:   source_detail || null,
      withdrawal_mode: withdrawal_mode || null,
      amount:          Number(amount),
      notes:           notes || null,
    }).eq('id', putTxnId).select('account_id').single()
    if (putErr) return res.status(500).json({ error: putErr.message })

    // Full balance recalculation from initial_balance + all transactions sorted by date
    const putAcctId = updatedTxn.account_id
    const { data: acctForPut } = await svcClient.from('bank_accounts').select('initial_balance').eq('id', putAcctId).single()
    const { data: allTxnsForRecalc } = await svcClient.from('bank_transactions').select('id, amount, transaction_type, transaction_date, created_at').eq('account_id', putAcctId).order('transaction_date', { ascending: true }).order('created_at', { ascending: true })

    let runningBal = Number(acctForPut?.initial_balance || 0)
    for (const recalcTxn of (allTxnsForRecalc || [])) {
      runningBal = recalcTxn.transaction_type === 'CREDIT' ? runningBal + Number(recalcTxn.amount) : runningBal - Number(recalcTxn.amount)
      await svcClient.from('bank_transactions').update({ balance_after: runningBal }).eq('id', recalcTxn.id)
    }
    await svcClient.from('bank_accounts').update({ balance: runningBal }).eq('id', putAcctId)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id: delTxnId } = req.body
    if (!delTxnId) return res.status(400).json({ error: 'id required' })

    const { data: txnToDelete } = await svcClient.from('bank_transactions').select('*').eq('id', delTxnId).single()
    if (!txnToDelete) return res.status(404).json({ error: 'Transaction not found' })

    await svcClient.from('bank_transactions').delete().eq('id', delTxnId)

    // Recalculate balance from scratch using initial_balance + all remaining transactions
    const { data: acctForRecalc } = await svcClient.from('bank_accounts').select('initial_balance').eq('id', txnToDelete.account_id).single()
    const { data: remainingTxns } = await svcClient.from('bank_transactions').select('amount, transaction_type').eq('account_id', txnToDelete.account_id)
    if (acctForRecalc) {
      const recalcBal = (acctForRecalc.initial_balance || 0) + (remainingTxns || []).reduce((sumBal, txnRow) => {
        return txnRow.transaction_type === 'CREDIT' ? sumBal + Number(txnRow.amount) : sumBal - Number(txnRow.amount)
      }, 0)
      await svcClient.from('bank_accounts').update({ balance: recalcBal }).eq('id', txnToDelete.account_id)
    }

    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
