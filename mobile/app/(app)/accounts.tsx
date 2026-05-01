import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { getAccounts, createAccount, deleteAccount, getTrades } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd  = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtM  = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10_000_000) return `₹${(a / 10_000_000).toFixed(2)} Cr`
  if (a >= 100_000)    return `₹${(a / 100_000).toFixed(2)} L`
  return `₹${fmt0(a)}`
}

export default function AccountsScreen() {
  const { role } = useAuth()
  const [accounts,   setAccounts]   = useState<any[]>([])
  const [trades,     setTrades]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [addModal,   setAddModal]   = useState(false)
  const [newName,    setNewName]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    try {
      const [acc, tr] = await Promise.all([getAccounts(), getTrades()])
      setAccounts(Array.isArray(acc) ? acc : [])
      setTrades(Array.isArray(tr) ? tr : [])
    } catch { /* empty state */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createAccount(newName.trim())
      setNewName('')
      setAddModal(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally { setSaving(false) }
  }

  const handleDelete = (id: string, name: string) =>
    Alert.alert('Delete Account', `Delete "${name}"? All trades in this account will be unlinked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAccount(id, name); load() }
        catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])

  const tradesFor = (name: string) => trades.filter(t => t.account === name)

  const statsFor = (name: string) => {
    const ts = tradesFor(name)
    const open   = ts.filter(t => t.status === 'OPEN')
    const closed = ts.filter(t => t.status === 'CLOSED')
    const invested = open.reduce((s, t) => s + Number(t.invested_capital || 0), 0)
    const realised = closed.reduce((s, t) => {
      const sign = t.direction === 'LONG' ? 1 : -1
      return s + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
    }, 0)
    const mtf = ts.filter(t => t.trade_type === 'MTF' && t.status === 'OPEN')
    const mtfInvested = mtf.reduce((s, t) => s + Number(t.invested_capital || 0), 0)
    return { open: open.length, closed: closed.length, invested, realised, mtf: mtf.length, mtfInvested }
  }

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  const selectedTrades = selected
    ? tradesFor(accounts.find(a => a.id === selected)?.name || '')
    : []

  return (
    <View style={s.container}>
      {/* Account tiles */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        {/* Add account button */}
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)}>
          <Text style={s.addBtnText}>+ Add Account</Text>
        </TouchableOpacity>

        {accounts.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No accounts yet</Text>
            <Text style={s.emptySub}>Create your first trading account above</Text>
          </View>
        ) : (
          accounts.map(acc => {
            const st  = statsFor(acc.name)
            const isSel = selected === acc.id
            return (
              <View key={acc.id}>
                <TouchableOpacity
                  style={[s.tile, isSel && s.tileActive]}
                  onPress={() => setSelected(isSel ? null : acc.id)}
                  activeOpacity={0.8}
                >
                  <View style={s.tileHead}>
                    <Text style={s.tileName}>{acc.name}</Text>
                    {role === 'admin' && (
                      <TouchableOpacity onPress={() => handleDelete(acc.id, acc.name)} hitSlop={8}>
                        <Text style={s.delText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={s.statRow}>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>OPEN</Text>
                      <Text style={[s.statVal, { color: colors.accent }]}>{st.open}</Text>
                    </View>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>CLOSED</Text>
                      <Text style={s.statVal}>{st.closed}</Text>
                    </View>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>INVESTED</Text>
                      <Text style={s.statVal}>{fmtM(st.invested)}</Text>
                    </View>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>REALISED</Text>
                      <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                        {st.realised >= 0 ? '+' : '−'}{fmtM(Math.abs(st.realised))}
                      </Text>
                    </View>
                  </View>

                  {st.mtf > 0 && (
                    <View style={s.mtfRow}>
                      <Text style={s.mtfText}>MTF: {st.mtf} positions · {fmtM(st.mtfInvested)} deployed</Text>
                    </View>
                  )}

                  <Text style={s.expandHint}>{isSel ? '▲ Hide trades' : '▼ Show trades'}</Text>
                </TouchableOpacity>

                {/* Expanded trade list */}
                {isSel && (
                  <View style={s.tradeList}>
                    {selectedTrades.length === 0 ? (
                      <Text style={s.noTrades}>No trades in this account</Text>
                    ) : (
                      selectedTrades.map(t => {
                        const isOpen = t.status === 'OPEN'
                        const pnl = !isOpen
                          ? (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
                          : null
                        return (
                          <View key={t.id} style={[s.tradeRow, isOpen ? s.tradeOpen : s.tradeClosed]}>
                            <View style={s.tradeLeft}>
                              <Text style={s.tradeTicker}>{t.ticker}</Text>
                              <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)} · {t.strategy || ''}</Text>
                            </View>
                            <View style={s.tradeRight}>
                              <Text style={s.tradeDir}>{t.direction}</Text>
                              <Text style={s.tradeStatus}>{t.status}</Text>
                              {pnl !== null && (
                                <Text style={[s.tradePnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                                  {pnl >= 0 ? '+' : '−'}₹{fmt0(Math.abs(pnl))}
                                </Text>
                              )}
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
      </ScrollView>

      {/* Add account modal */}
      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>New Account</Text>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Account name (e.g. Zerodha)"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddModal(false); setNewName('') }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Create'}</Text>
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

  addBtn:     { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.md },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },
  emptySub:  { fontSize: font.size.md, color: colors.muted, marginTop: spacing.sm },

  tile: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm,
    borderLeftWidth: 4, borderLeftColor: colors.border2,
  },
  tileActive: { borderLeftColor: colors.accent, borderColor: colors.accent },
  tileHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  tileName:   { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  delText:    { fontSize: font.size.sm, color: colors.red, fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat:    { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  statLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  statVal:   { fontSize: font.size.md, fontWeight: '800', color: colors.text },

  mtfRow:  { backgroundColor: '#fef9c3', borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  mtfText: { fontSize: font.size.xs, color: '#92400e', fontWeight: '600' },

  expandHint: { fontSize: font.size.xs, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },

  tradeList: { backgroundColor: colors.surface2, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  noTrades:  { padding: spacing.lg, color: colors.muted, textAlign: 'center' },
  tradeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeOpen:   { borderLeftWidth: 3, borderLeftColor: colors.accent },
  tradeClosed: { borderLeftWidth: 3, borderLeftColor: colors.border2 },
  tradeLeft:  {},
  tradeTicker:{ fontSize: font.size.md, fontWeight: '800', color: colors.text },
  tradeMeta:  { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  tradeRight: { alignItems: 'flex-end' },
  tradeDir:   { fontSize: font.size.xs, color: colors.muted, fontWeight: '700' },
  tradeStatus:{ fontSize: font.size.xs, color: colors.muted },
  tradePnl:   { fontSize: font.size.sm, fontWeight: '700', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  modalBox: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  modalTitle: { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text,
  },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
