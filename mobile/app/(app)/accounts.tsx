import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import {
  getAccounts, createAccount, deleteAccount, getTrades,
  getAdminMirror, getSubscriberTrades, getSharedAccountTrades, createTrade,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtM = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`
  if (a >= 100_000)    return `₹${(n / 100_000).toFixed(2)} L`
  return `₹${fmt0(n)}`
}

const EMPTY_TRADE = { ticker: '', direction: 'LONG', entry_date: new Date().toISOString().slice(0, 10), entry_price: '', quantity: '' }

export default function AccountsScreen() {
  const { session, role } = useAuth()
  const isAdmin = role === 'admin'

  const [accounts,          setAccounts]         = useState<any[]>([])
  const [ownTrades,         setOwnTrades]         = useState<any[]>([])
  const [mirroredAccounts,  setMirroredAccounts]  = useState<any[]>([])
  const [mirroredTradesMap, setMirroredTradesMap] = useState<Record<string, any[]>>({})
  const [sharedTrades,      setSharedTrades]      = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [refreshing,        setRefreshing]        = useState(false)
  const [selected,          setSelected]          = useState<string | null>(null)

  const [addAcctModal,  setAddAcctModal]  = useState(false)
  const [newName,       setNewName]       = useState('')
  const [savingAcct,    setSavingAcct]    = useState(false)

  const [addTradeModal, setAddTradeModal] = useState(false)
  const [tradeAcct,     setTradeAcct]     = useState('')
  const [tradeForm,     setTradeForm]     = useState({ ...EMPTY_TRADE })
  const [savingTrade,   setSavingTrade]   = useState(false)

  const load = useCallback(async () => {
    try {
      const [acc, tr] = await Promise.all([getAccounts(), getTrades()])
      setAccounts(Array.isArray(acc) ? acc : [])
      setOwnTrades(Array.isArray(tr) ? tr : [])

      if (isAdmin) {
        const mirror = await getAdminMirror().catch(() => [])
        const accounts = Array.isArray(mirror) ? mirror : []
        setMirroredAccounts(accounts)
        const map: Record<string, any[]> = {}
        await Promise.all(accounts.map(async (m: any) => {
          try {
            const d = await getSubscriberTrades(m.subscriber_id)
            map[m.subscriber_id] = Array.isArray(d?.trades) ? d.trades : (Array.isArray(d) ? d : [])
          } catch { map[m.subscriber_id] = [] }
        }))
        setMirroredTradesMap(map)
      } else {
        const shared = await getSharedAccountTrades().catch(() => ({ trades: [] }))
        setSharedTrades(Array.isArray(shared?.trades) ? shared.trades : [])
      }
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const handleAddAccount = async () => {
    if (!newName.trim()) return
    setSavingAcct(true)
    try {
      await createAccount(newName.trim())
      setNewName(''); setAddAcctModal(false)
      load()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setSavingAcct(false) }
  }

  const handleDeleteAccount = (id: string, name: string) =>
    Alert.alert('Delete Account', `Delete "${name}"? Trades in this account will be unlinked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAccount(id, name); load() }
        catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])

  const openAddTrade = (accName: string) => {
    setTradeAcct(accName)
    setTradeForm({ ...EMPTY_TRADE })
    setAddTradeModal(true)
  }

  const handleAddTrade = async () => {
    const { ticker, direction, entry_date, entry_price, quantity } = tradeForm
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker'); return }
    if (!entry_price || !quantity) { Alert.alert('Error', 'Entry price and quantity required'); return }
    setSavingTrade(true)
    try {
      const qty = parseFloat(quantity)
      const price = parseFloat(entry_price)
      await createTrade({
        account: tradeAcct,
        ticker: ticker.trim().toUpperCase(),
        direction,
        entry_date,
        entry_price: price,
        quantity: qty,
        invested_capital: price * qty,
        status: 'OPEN',
        trade_type: 'NORMAL',
      })
      setAddTradeModal(false)
      load()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setSavingTrade(false) }
  }

  const ownStatsFor = (name: string) => {
    const ts = ownTrades.filter(t => t.account === name)
    const open    = ts.filter(t => t.status === 'OPEN')
    const closed  = ts.filter(t => t.status === 'CLOSED')
    const invested = open.reduce((s, t) => s + Number(t.invested_capital || 0), 0)
    const realised = closed.reduce((s, t) => {
      const sign = t.direction === 'LONG' ? 1 : -1
      return s + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
    }, 0)
    const mtf = ts.filter(t => t.trade_type === 'MTF' && t.status === 'OPEN')
    return { open: open.length, closed: closed.length, invested, realised, mtfCount: mtf.length, trades: ts }
  }

  const mirroredStatsFor = (subId: string) => {
    const ts = mirroredTradesMap[subId] || []
    const open    = ts.filter(t => t.status === 'OPEN')
    const closed  = ts.filter(t => t.status === 'CLOSED')
    const invested = open.reduce((s: number, t: any) => s + Number(t.invested_capital || 0), 0)
    const realised = closed.reduce((s: number, t: any) => {
      const sign = t.direction === 'LONG' ? 1 : -1
      return s + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
    }, 0)
    return { open: open.length, closed: closed.length, invested, realised, trades: ts }
  }

  const sharedAccountNames = [...new Set(sharedTrades.map(t => t.account).filter(Boolean))]

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        {/* Add account button */}
        {isAdmin && (
          <TouchableOpacity style={s.addAcctBtn} onPress={() => setAddAcctModal(true)}>
            <Text style={s.addAcctBtnText}>+ Add Account</Text>
          </TouchableOpacity>
        )}

        {/* ── Own accounts ── */}
        {accounts.length === 0 && !isAdmin ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No accounts yet</Text>
          </View>
        ) : (
          accounts.map(acc => {
            const st   = ownStatsFor(acc.name)
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
                    <View style={s.tileActions}>
                      <TouchableOpacity style={s.addTradeBtn} onPress={() => openAddTrade(acc.name)}>
                        <Text style={s.addTradeBtnText}>+ Trade</Text>
                      </TouchableOpacity>
                      {isAdmin && (
                        <TouchableOpacity onPress={() => handleDeleteAccount(acc.id, acc.name)} hitSlop={8}>
                          <Text style={s.delText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={s.statRow}>
                    <View style={s.stat}><Text style={s.statLabel}>OPEN</Text><Text style={[s.statVal, { color: colors.accent }]}>{st.open}</Text></View>
                    <View style={s.stat}><Text style={s.statLabel}>CLOSED</Text><Text style={s.statVal}>{st.closed}</Text></View>
                    <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(st.invested)}</Text></View>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>REALISED</Text>
                      <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                        {st.realised >= 0 ? '+' : '−'}{fmtM(Math.abs(st.realised))}
                      </Text>
                    </View>
                  </View>

                  {st.mtfCount > 0 && (
                    <View style={s.mtfRow}><Text style={s.mtfText}>MTF: {st.mtfCount} open positions</Text></View>
                  )}
                  <Text style={s.expandHint}>{isSel ? '▲ Hide trades' : '▼ Show trades'}</Text>
                </TouchableOpacity>

                {isSel && (
                  <View style={s.tradeList}>
                    {st.trades.length === 0 ? (
                      <Text style={s.noTrades}>No trades in this account</Text>
                    ) : (
                      st.trades.map(t => {
                        const isOpen = t.status === 'OPEN'
                        const pnl = !isOpen
                          ? (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
                          : null
                        return (
                          <View key={t.id} style={[s.tradeRow, isOpen ? s.tradeOpen : s.tradeClosed]}>
                            <View>
                              <Text style={s.tradeTicker}>{t.ticker}</Text>
                              <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)} · {t.strategy || ''}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
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

        {/* ── Mirrored subscriber accounts (admin only) ── */}
        {isAdmin && mirroredAccounts.length > 0 && (
          <>
            <Text style={s.sectionLabel}>MIRRORED SUBSCRIBER ACCOUNTS</Text>
            {mirroredAccounts.map((m: any) => {
              const subId = m.subscriber_id
              const subName = (m.subscriber_name || m.subscriber_email || 'Subscriber').split(' ')[0]
              const st = mirroredStatsFor(subId)
              const key = `mirror-${subId}`
              const isSel = selected === key
              return (
                <View key={key}>
                  <TouchableOpacity
                    style={[s.tile, s.tileMirrored, isSel && s.tileActive]}
                    onPress={() => setSelected(isSel ? null : key)}
                    activeOpacity={0.8}
                  >
                    <View style={s.tileHead}>
                      <View>
                        <Text style={s.tileName}>{subName}'s Accounts</Text>
                        <Text style={s.tileSubEmail}>{m.subscriber_email}</Text>
                      </View>
                      <View style={s.mirrorBadge}><Text style={s.mirrorText}>MIRRORED</Text></View>
                    </View>
                    <View style={s.statRow}>
                      <View style={s.stat}><Text style={s.statLabel}>OPEN</Text><Text style={[s.statVal, { color: colors.accent }]}>{st.open}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>CLOSED</Text><Text style={s.statVal}>{st.closed}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(st.invested)}</Text></View>
                      <View style={s.stat}>
                        <Text style={s.statLabel}>REALISED</Text>
                        <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                          {st.realised >= 0 ? '+' : '−'}{fmtM(Math.abs(st.realised))}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.expandHint}>{isSel ? '▲ Hide trades' : '▼ Show trades'}</Text>
                  </TouchableOpacity>
                  {isSel && (
                    <View style={s.tradeList}>
                      {st.trades.length === 0 ? (
                        <Text style={s.noTrades}>No trades found</Text>
                      ) : (
                        st.trades.slice(0, 30).map((t: any) => {
                          const isOpen = t.status === 'OPEN'
                          return (
                            <View key={t.id} style={[s.tradeRow, isOpen ? s.tradeOpen : s.tradeClosed]}>
                              <View>
                                <Text style={s.tradeTicker}>{t.ticker}</Text>
                                <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)} · {t.account || ''}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={s.tradeDir}>{t.direction}</Text>
                                <Text style={s.tradeStatus}>{t.status}</Text>
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
          </>
        )}

        {/* ── Shared admin accounts (subscriber only) ── */}
        {!isAdmin && sharedAccountNames.length > 0 && (
          <>
            <Text style={s.sectionLabel}>SHARED BY ADMIN</Text>
            {sharedAccountNames.map(accName => {
              const accTrades = sharedTrades.filter(t => t.account === accName)
              const open    = accTrades.filter(t => t.status === 'OPEN')
              const closed  = accTrades.filter(t => t.status === 'CLOSED')
              const invested = open.reduce((sum: number, t: any) => sum + Number(t.invested_capital || 0), 0)
              const realised = closed.reduce((sum: number, t: any) => {
                const sign = t.direction === 'LONG' ? 1 : -1
                return sum + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
              }, 0)
              const key = `shared-${accName}`
              const isSel = selected === key
              return (
                <View key={key}>
                  <TouchableOpacity
                    style={[s.tile, s.tileShared, isSel && s.tileActive]}
                    onPress={() => setSelected(isSel ? null : key)}
                    activeOpacity={0.8}
                  >
                    <View style={s.tileHead}>
                      <Text style={s.tileName}>{accName}</Text>
                      <View style={s.readOnlyBadge}><Text style={s.readOnlyText}>READ ONLY</Text></View>
                    </View>
                    <View style={s.statRow}>
                      <View style={s.stat}><Text style={s.statLabel}>OPEN</Text><Text style={[s.statVal, { color: colors.accent }]}>{open.length}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>CLOSED</Text><Text style={s.statVal}>{closed.length}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(invested)}</Text></View>
                      <View style={s.stat}>
                        <Text style={s.statLabel}>REALISED</Text>
                        <Text style={[s.statVal, { color: realised >= 0 ? colors.green : colors.red }]}>
                          {realised >= 0 ? '+' : '−'}{fmtM(Math.abs(realised))}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.expandHint}>{isSel ? '▲ Hide trades' : '▼ Show trades'}</Text>
                  </TouchableOpacity>
                  {isSel && (
                    <View style={s.tradeList}>
                      {accTrades.length === 0 ? <Text style={s.noTrades}>No trades</Text> : accTrades.slice(0, 30).map((t: any) => (
                        <View key={t.id} style={[s.tradeRow, t.status === 'OPEN' ? s.tradeOpen : s.tradeClosed]}>
                          <View>
                            <Text style={s.tradeTicker}>{t.ticker}</Text>
                            <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.tradeDir}>{t.direction}</Text>
                            <Text style={s.tradeStatus}>{t.status}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={addAcctModal} transparent animationType="fade" onRequestClose={() => setAddAcctModal(false)}>
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
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddAcctModal(false); setNewName('') }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingAcct && { opacity: 0.6 }]} onPress={handleAddAccount} disabled={savingAcct}>
                <Text style={s.saveText}>{savingAcct ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Trade Modal */}
      <Modal visible={addTradeModal} transparent animationType="slide" onRequestClose={() => setAddTradeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>New Trade — {tradeAcct}</Text>

            <Text style={s.fieldLabel}>TICKER</Text>
            <TextInput
              style={s.input}
              value={tradeForm.ticker}
              onChangeText={v => setTradeForm(f => ({ ...f, ticker: v.toUpperCase() }))}
              placeholder="e.g. RELIANCE"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
            />

            <Text style={s.fieldLabel}>DIRECTION</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              {(['LONG', 'SHORT'] as const).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.dirBtn, tradeForm.direction === d && s.dirBtnActive]}
                  onPress={() => setTradeForm(f => ({ ...f, direction: d }))}
                >
                  <Text style={[s.dirBtnText, tradeForm.direction === d && s.dirBtnTextActive]}>
                    {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>ENTRY DATE</Text>
            <TextInput
              style={s.input}
              value={tradeForm.entry_date}
              onChangeText={v => setTradeForm(f => ({ ...f, entry_date: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>ENTRY PRICE ₹</Text>
                <TextInput
                  style={s.input}
                  value={tradeForm.entry_price}
                  onChangeText={v => setTradeForm(f => ({ ...f, entry_price: v }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>QUANTITY</Text>
                <TextInput
                  style={s.input}
                  value={tradeForm.quantity}
                  onChangeText={v => setTradeForm(f => ({ ...f, quantity: v }))}
                  placeholder="100"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAddTradeModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingTrade && { opacity: 0.6 }]} onPress={handleAddTrade} disabled={savingTrade}>
                <Text style={s.saveText}>{savingTrade ? 'Adding…' : 'Add Trade'}</Text>
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
  list:      { padding: spacing.lg, paddingBottom: 80 },

  addAcctBtn:     { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  addAcctBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.md },

  sectionLabel: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },

  tile:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.border2 },
  tileActive:  { borderLeftColor: colors.accent, borderColor: colors.accent },
  tileMirrored:{ borderLeftColor: colors.gold },
  tileShared:  { borderLeftColor: colors.accent, borderWidth: 2, borderColor: colors.accent },
  tileHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  tileName:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  tileSubEmail:{ fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  tileActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addTradeBtn:     { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 4 },
  addTradeBtnText: { fontSize: font.size.xs, color: colors.white, fontWeight: '700' },
  delText:         { fontSize: font.size.sm, color: colors.red, fontWeight: '600' },

  mirrorBadge: { backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  mirrorText:  { fontSize: font.size.xs, color: colors.gold, fontWeight: '700' },
  readOnlyBadge: { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  readOnlyText:  { fontSize: font.size.xs, color: colors.accent2, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  stat:    { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  statLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  statVal:   { fontSize: font.size.sm, fontWeight: '800', color: colors.text },

  mtfRow:  { backgroundColor: '#fef9c3', borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  mtfText: { fontSize: font.size.xs, color: '#92400e', fontWeight: '600' },

  expandHint: { fontSize: font.size.xs, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },

  tradeList: { backgroundColor: colors.surface2, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  noTrades:  { padding: spacing.lg, color: colors.muted, textAlign: 'center' },
  tradeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeOpen:   { borderLeftWidth: 3, borderLeftColor: colors.accent },
  tradeClosed: { borderLeftWidth: 3, borderLeftColor: colors.border2 },
  tradeTicker: { fontSize: font.size.md, fontWeight: '800', color: colors.text },
  tradeMeta:   { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  tradeDir:    { fontSize: font.size.xs, color: colors.muted, fontWeight: '700' },
  tradeStatus: { fontSize: font.size.xs, color: colors.muted },
  tradePnl:    { fontSize: font.size.sm, fontWeight: '700', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  modalBox: { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  modalTitle: { fontSize: font.size.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  fieldLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text, marginBottom: spacing.xs,
  },
  dirBtn:         { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  dirBtnActive:   { borderColor: colors.accent, backgroundColor: colors.accentDim },
  dirBtnText:     { fontSize: font.size.sm, fontWeight: '700', color: colors.muted },
  dirBtnTextActive:{ color: colors.accent },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
