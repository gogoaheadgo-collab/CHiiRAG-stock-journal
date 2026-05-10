import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import {
  getBankAccounts, getBankAccountsForUser, getBankTransactions,
  createBankTransaction, deleteBankTransaction, getAdminMirror,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

type TxType = 'CASH_DEPOSIT' | 'CASH_WITHDRAWAL' | 'ACCOUNT_TRANSFER'

const TX_LABELS: Record<TxType, string> = {
  CASH_DEPOSIT:     'Cash Deposit',
  CASH_WITHDRAWAL:  'Cash Withdrawal',
  ACCOUNT_TRANSFER: 'A2A Transfer',
}

export default function BankScreen() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [accounts,    setAccounts]    = useState<any[]>([])
  const [subscriberBankData, setSubscriberBankData] = useState<{ subName: string; subId: string; accounts: any[] }[]>([])
  const [txMap,       setTxMap]       = useState<Record<string, any[]>>({})
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [txModal,     setTxModal]     = useState(false)
  const [txAccount,   setTxAccount]   = useState<any | null>(null)
  const [txType,      setTxType]      = useState<TxType>('CASH_DEPOSIT')
  const [txAmount,    setTxAmount]    = useState('')
  const [txDesc,      setTxDesc]      = useState('')
  const [txToId,      setTxToId]      = useState('')
  const [txDate,      setTxDate]      = useState(new Date().toISOString().slice(0, 10))
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    try {
      const acc = await getBankAccounts()
      setAccounts(Array.isArray(acc) ? acc : [])

      if (isAdmin) {
        const mirror = await getAdminMirror().catch(() => [])
        const mirrorList = Array.isArray(mirror) ? mirror : []
        const subData: { subName: string; subId: string; accounts: any[] }[] = []
        await Promise.all(mirrorList.map(async (m: any) => {
          try {
            const subAccs = await getBankAccountsForUser(m.subscriber_id)
            if (Array.isArray(subAccs) && subAccs.length > 0) {
              subData.push({
                subName: (m.subscriber_name || m.subscriber_email || 'Subscriber').split(' ')[0],
                subId: m.subscriber_id,
                accounts: subAccs,
              })
            }
          } catch { /* skip subscriber */ }
        }))
        setSubscriberBankData(subData)
      }
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const loadTx = async (account_id: string) => {
    try {
      const tx = await getBankTransactions(account_id)
      setTxMap(m => ({ ...m, [account_id]: Array.isArray(tx) ? tx : [] }))
    } catch { /* ignore */ }
  }

  const toggleExpand = (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!txMap[id]) loadTx(id)
  }

  const openTxModal = (acc: any) => {
    setTxAccount(acc)
    setTxType('CASH_DEPOSIT')
    setTxAmount('')
    setTxDesc('')
    setTxToId('')
    setTxDate(new Date().toISOString().slice(0, 10))
    setTxModal(true)
  }

  const handleRecordTx = async () => {
    if (!txAmount || isNaN(Number(txAmount))) {
      Alert.alert('Error', 'Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const isTransfer = txType === 'ACCOUNT_TRANSFER'
      const body: any = {
        account_id:       txAccount.id,
        transaction_date: txDate || new Date().toISOString().slice(0, 10),
        transaction_type: txType === 'CASH_DEPOSIT' ? 'CREDIT' : 'DEBIT',
        source_type:      isTransfer ? 'A2A_TRANSFER' : txType,
        amount:           Number(txAmount),
        notes:            txDesc.trim() || undefined,
      }
      if (isTransfer && txToId) body.a2a_partner_account_id = txToId
      await createBankTransaction(body)
      setTxModal(false)
      setTxMap(m => { const n = { ...m }; delete n[txAccount.id]; return n })
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally { setSaving(false) }
  }

  const handleDeleteTx = (tx: any) =>
    Alert.alert('Delete Transaction', 'Remove this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteBankTransaction(tx.id)
        setTxMap(m => ({ ...m, [tx.account_id]: (m[tx.account_id] || []).filter(t => t.id !== tx.id) }))
        load()
      }},
    ])

  const allAccounts = [...accounts, ...subscriberBankData.flatMap(s => s.accounts)]
  const total = allAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        {/* Total balance header */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>TOTAL BANK BALANCE</Text>
          <Text style={s.totalVal}>₹{fmtd(total)}</Text>
          <Text style={s.totalSub}>{allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''}</Text>
        </View>

        {accounts.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No bank accounts</Text>
            <Text style={s.emptySub}>Add accounts from the web app</Text>
          </View>
        ) : (
          accounts.map(acc => {
            const gain   = Number(acc.balance) - Number(acc.initial_balance)
            const isGain = gain >= 0
            const pct    = Number(acc.initial_balance) > 0 ? (gain / Number(acc.initial_balance) * 100) : 0
            const isExp  = expanded === acc.id
            const txList = txMap[acc.id] || []

            return (
              <View key={acc.id} style={s.accBlock}>
                {/* Account tile */}
                <View style={[s.card, { borderLeftColor: isGain ? colors.bull : colors.bear }]}>
                  <View style={s.cardHead}>
                    <View>
                      <Text style={s.holderName}>{acc.holder_name}</Text>
                      <Text style={s.bankName}>{acc.bank_name}</Text>
                    </View>
                    <View style={s.right}>
                      <Text style={s.balance}>₹{fmtd(acc.balance)}</Text>
                      <Text style={[s.gain, { color: isGain ? colors.bull : colors.bear }]}>
                        {isGain ? '+' : '−'}₹{fmtd(Math.abs(gain))} ({isGain ? '+' : ''}{pct.toFixed(2)}%)
                      </Text>
                    </View>
                  </View>

                  <View style={s.barBg}>
                    <View style={[s.barFill, {
                      backgroundColor: isGain ? colors.bull : colors.bear,
                      width: `${Math.min(100, Math.max(5, (Number(acc.balance) / Math.max(Number(acc.initial_balance), Number(acc.balance))) * 100))}%` as any,
                    }]} />
                  </View>

                  <View style={s.cardFoot}>
                    <Text style={s.footText}>Initial: ₹{fmtd(acc.initial_balance)}</Text>
                    <View style={s.footBtns}>
                      <TouchableOpacity style={s.txBtn} onPress={() => openTxModal(acc)}>
                        <Text style={s.txBtnText}>+ Transaction</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleExpand(acc.id)}>
                        <Text style={s.histText}>{isExp ? '▲ Hide' : '▼ History'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Transaction history */}
                {isExp && (
                  <View style={s.txList}>
                    {txList.length === 0 ? (
                      <Text style={s.noTx}>No transactions yet</Text>
                    ) : (
                      txList.map(tx => {
                        const isDeposit = tx.source_type === 'CASH_DEPOSIT'
                        const isWithdraw = tx.source_type === 'CASH_WITHDRAWAL'
                        return (
                          <View key={tx.id} style={s.txRow}>
                            <View style={s.txLeft}>
                              <Text style={s.txType}>{TX_LABELS[tx.source_type as TxType] || tx.source_type}</Text>
                              <Text style={s.txDate}>{(tx.transaction_date || tx.created_at)?.slice(0, 10)}</Text>
                              {tx.notes ? <Text style={s.txDesc}>{tx.notes}</Text> : null}
                            </View>
                            <View style={s.txRight}>
                              <Text style={[s.txAmt, {
                                color: isDeposit ? colors.green : isWithdraw ? colors.red : colors.accent
                              }]}>
                                {isDeposit ? '+' : isWithdraw ? '−' : '↔'}₹{fmt0(Math.abs(tx.amount))}
                              </Text>
                              <TouchableOpacity onPress={() => handleDeleteTx(tx)}>
                                <Text style={s.txDel}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      })
                    )}
                  </View>
                )}
              </View>
            )
          })
        )}

        {/* ── Subscriber bank accounts (admin only) ── */}
        {isAdmin && subscriberBankData.length > 0 && subscriberBankData.map(sub => (
          <View key={sub.subId}>
            <Text style={s.subSection}>{sub.subName.toUpperCase()}'S ACCOUNTS</Text>
            {sub.accounts.map(acc => {
              const gain   = Number(acc.balance) - Number(acc.initial_balance)
              const isGain = gain >= 0
              const pct    = Number(acc.initial_balance) > 0 ? (gain / Number(acc.initial_balance) * 100) : 0
              const isExp  = expanded === acc.id
              const txList = txMap[acc.id] || []
              return (
                <View key={acc.id} style={s.accBlock}>
                  <View style={[s.card, { borderLeftColor: isGain ? colors.bull : colors.bear }]}>
                    <View style={s.cardHead}>
                      <View>
                        <Text style={s.holderName}>{acc.holder_name}</Text>
                        <Text style={s.bankName}>{acc.bank_name}</Text>
                      </View>
                      <View style={s.right}>
                        <Text style={s.balance}>₹{fmtd(acc.balance)}</Text>
                        <Text style={[s.gain, { color: isGain ? colors.bull : colors.bear }]}>
                          {isGain ? '+' : '−'}₹{fmtd(Math.abs(gain))} ({isGain ? '+' : ''}{pct.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, {
                        backgroundColor: isGain ? colors.bull : colors.bear,
                        width: `${Math.min(100, Math.max(5, (Number(acc.balance) / Math.max(Number(acc.initial_balance), Number(acc.balance))) * 100))}%` as any,
                      }]} />
                    </View>
                    <View style={s.cardFoot}>
                      <Text style={s.footText}>Initial: ₹{fmtd(acc.initial_balance)}</Text>
                      <View style={s.footBtns}>
                        <TouchableOpacity style={s.txBtn} onPress={() => openTxModal(acc)}>
                          <Text style={s.txBtnText}>+ Transaction</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleExpand(acc.id)}>
                          <Text style={s.histText}>{isExp ? '▲ Hide' : '▼ History'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {isExp && (
                    <View style={s.txList}>
                      {txList.length === 0 ? (
                        <Text style={s.noTx}>No transactions yet</Text>
                      ) : (
                        txList.map(tx => {
                          const isDeposit  = tx.source_type === 'CASH_DEPOSIT'
                          const isWithdraw = tx.source_type === 'CASH_WITHDRAWAL'
                          return (
                            <View key={tx.id} style={s.txRow}>
                              <View style={s.txLeft}>
                                <Text style={s.txType}>{TX_LABELS[tx.source_type as TxType] || tx.source_type}</Text>
                                <Text style={s.txDate}>{(tx.transaction_date || tx.created_at)?.slice(0, 10)}</Text>
                                {tx.notes ? <Text style={s.txDesc}>{tx.notes}</Text> : null}
                              </View>
                              <View style={s.txRight}>
                                <Text style={[s.txAmt, { color: isDeposit ? colors.green : isWithdraw ? colors.red : colors.accent }]}>
                                  {isDeposit ? '+' : isWithdraw ? '−' : '↔'}₹{fmt0(Math.abs(tx.amount))}
                                </Text>
                              </View>
                            </View>
                          )
                        })
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
      </ScrollView>

      {/* Record Transaction Modal */}
      <Modal visible={txModal} transparent animationType="slide" onRequestClose={() => setTxModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Record Transaction</Text>
            {txAccount && (
              <Text style={s.modalSub}>{txAccount.bank_name} · ₹{fmtd(txAccount.balance)}</Text>
            )}

            {/* Type selector */}
            <View style={s.typeRow}>
              {(['CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'ACCOUNT_TRANSFER'] as TxType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeBtn, txType === t && s.typeBtnActive]}
                  onPress={() => setTxType(t)}
                >
                  <Text style={[s.typeBtnText, txType === t && s.typeBtnTextActive]}>
                    {t === 'CASH_DEPOSIT' ? 'Deposit' : t === 'CASH_WITHDRAWAL' ? 'Withdraw' : 'Transfer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.input}
              value={txDate}
              onChangeText={setTxDate}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={colors.muted}
            />

            <TextInput
              style={s.input}
              value={txAmount}
              onChangeText={setTxAmount}
              placeholder="Amount (₹)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />

            {txType === 'ACCOUNT_TRANSFER' && (
              <View>
                <Text style={s.inputLabel}>To Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                  {accounts.filter(a => a.id !== txAccount?.id).map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[s.accChip, txToId === a.id && s.accChipActive]}
                      onPress={() => setTxToId(a.id)}
                    >
                      <Text style={[s.accChipText, txToId === a.id && { color: colors.white }]}>{a.bank_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput
              style={s.input}
              value={txDesc}
              onChangeText={setTxDesc}
              placeholder="Description (optional)"
              placeholderTextColor={colors.muted}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setTxModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleRecordTx} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Record'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list:      { padding: spacing.lg, paddingBottom: 120 },

  totalCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center',
    marginBottom: spacing.lg, borderTopWidth: 4, borderTopColor: colors.saffron,
  },
  totalLabel: { fontSize: font.size.sm, color: colors.muted, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.sm },
  totalVal:   { fontSize: font.size.h1, fontWeight: '800', color: colors.text, marginBottom: 4 },
  totalSub:   { fontSize: font.size.sm, color: colors.muted },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },
  emptySub:  { fontSize: font.size.md, color: colors.muted, marginTop: spacing.sm },

  subSection: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  accBlock: { marginBottom: spacing.sm },
  card:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  holderName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  bankName:   { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  right:      { alignItems: 'flex-end' },
  balance:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  gain:       { fontSize: font.size.sm, marginTop: 3 },
  barBg:   { height: 8, backgroundColor: colors.surface2, borderRadius: 4, marginBottom: spacing.md, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footText: { fontSize: font.size.sm, color: colors.muted },
  footBtns: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  txBtn:     { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 5 },
  txBtnText: { color: colors.white, fontSize: font.size.xs, fontWeight: '700' },
  histText:  { fontSize: font.size.sm, color: colors.accent, fontWeight: '600' },

  txList: { backgroundColor: colors.surface2, borderRadius: radius.md, overflow: 'hidden', marginTop: 2 },
  noTx:   { padding: spacing.lg, color: colors.muted, textAlign: 'center' },
  txRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  txLeft:  {},
  txType:  { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  txDate:  { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  txDesc:  { fontSize: font.size.xs, color: colors.muted },
  txRight: { alignItems: 'flex-end' },
  txAmt:   { fontSize: font.size.md, fontWeight: '800' },
  txDel:   { fontSize: font.size.xs, color: colors.red, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  modalTitle: { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  modalSub:   { fontSize: font.size.sm, color: colors.muted, marginTop: -spacing.sm },
  typeRow:    { flexDirection: 'row', gap: spacing.sm },
  typeBtn:    { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.sm, alignItems: 'center' },
  typeBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeBtnText:   { fontSize: font.size.xs, fontWeight: '700', color: colors.muted },
  typeBtnTextActive: { color: colors.white },
  inputLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text,
  },
  accChip:     { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 6, marginRight: spacing.sm, backgroundColor: colors.surface },
  accChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  accChipText: { fontSize: font.size.sm, color: colors.text, fontWeight: '600' },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
