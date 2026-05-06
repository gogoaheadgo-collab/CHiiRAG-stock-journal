import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native'
import {
  getSubscribers, getPendingUsers, approveUser,
  deleteSubscriber, getSubscriberTrades, getStockPrice,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'
import { Redirect } from 'expo-router'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function SubscribersScreen() {
  const { role, loading: authLoading } = useAuth()

  const [subscribers,  setSubscribers]  = useState<any[]>([])
  const [pending,      setPending]      = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [detailUser,   setDetailUser]   = useState<any | null>(null)
  const [detailTrades, setDetailTrades] = useState<any[]>([])
  const [detailExecs,  setDetailExecs]  = useState<any[]>([])
  const [detailPrices, setDetailPrices] = useState<Record<string, number>>({})
  const [detailLoad,   setDetailLoad]   = useState(false)

  if (!authLoading && role !== 'admin') return <Redirect href="/(app)/dashboard" />

  const load = useCallback(async () => {
    try {
      const [subs, pend] = await Promise.all([getSubscribers(), getPendingUsers()])
      setSubscribers(Array.isArray(subs) ? subs : [])
      setPending(Array.isArray(pend) ? pend : [])
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = (user_id: string, status: 'approved' | 'denied') =>
    Alert.alert(
      status === 'approved' ? 'Approve User' : 'Deny User',
      `${status === 'approved' ? 'Approve' : 'Deny'} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: status === 'approved' ? 'Approve' : 'Deny', style: status === 'approved' ? 'default' : 'destructive',
          onPress: async () => { await approveUser(user_id, status); load() }
        },
      ]
    )

  const handleDelete = (user_id: string, email: string) =>
    Alert.alert('Delete Subscriber', `Remove ${email}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSubscriber(user_id); load() } },
    ])

  const openDetail = async (sub: any) => {
    setDetailUser(sub)
    setDetailLoad(true)
    setDetailTrades([])
    setDetailExecs([])
    setDetailPrices({})
    try {
      const data = await getSubscriberTrades(sub.id || sub.user_id)
      const trades: any[] = Array.isArray(data) ? data : (Array.isArray(data?.trades) ? data.trades : [])
      const execs: any[]  = Array.isArray(data?.executions) ? data.executions : []
      setDetailTrades(trades)
      setDetailExecs(execs)
      const openTickers = [...new Set(
        trades.filter((t: any) => t.status === 'OPEN').map((t: any) => t.ticker as string)
      )]
      const prices: Record<string, number> = {}
      await Promise.all(openTickers.map(async ticker => {
        try {
          const d = await getStockPrice(ticker)
          if (d?.price) prices[ticker] = d.price
        } catch {}
      }))
      setDetailPrices(prices)
    } catch { setDetailTrades([]); setDetailExecs([]) }
    finally { setDetailLoad(false) }
  }

  const statsFromTrades = (trades: any[], execs: any[], prices: Record<string, number>) => {
    const open   = trades.filter(t => t.status === 'OPEN')
    const closed = trades.filter(t => t.status === 'CLOSED')
    const invested = open.reduce((s, t) => s + Number(t.invested_capital || 0), 0)
    let realised = 0
    trades.forEach(t => {
      const tExecs = execs.filter((e: any) => e.trade_id === t.id)
      realised += tExecs.reduce((s: number, e: any) =>
        s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    })
    let unrealised = 0
    let hasLive = false
    open.forEach(t => {
      const cmp = prices[t.ticker]
      if (!cmp) return
      hasLive = true
      const tExecs = execs.filter((e: any) => e.trade_id === t.id)
      const soldQty = tExecs.reduce((s: number, e: any) => s + Number(e.quantity || 0), 0)
      const currQty = Math.max(0, Number(t.quantity) - soldQty)
      unrealised += t.direction === 'SHORT'
        ? (Number(t.entry_price) - cmp) * currQty
        : (cmp - Number(t.entry_price)) * currQty
    })
    return { open: open.length, closed: closed.length, invested, realised, unrealised, hasLive }
  }

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        {/* Pending approvals */}
        {pending.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>PENDING APPROVAL ({pending.length})</Text>
            {pending.map(u => (
              <View key={u.user_id} style={s.pendingCard}>
                <View>
                  <Text style={s.userEmail}>{u.email}</Text>
                  <Text style={s.userMeta}>{u.full_name || 'No name'} · Requested access</Text>
                </View>
                <View style={s.pendingBtns}>
                  <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(u.user_id, 'approved')}>
                    <Text style={s.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.denyBtn} onPress={() => handleApprove(u.user_id, 'denied')}>
                    <Text style={s.denyBtnText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Subscribers list */}
        <Text style={s.sectionTitle}>SUBSCRIBERS ({subscribers.length})</Text>
        {subscribers.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No subscribers yet</Text>
          </View>
        ) : (
          subscribers.map(sub => (
            <View key={sub.user_id} style={s.subCard}>
              <View style={s.subHead}>
                <View style={s.subLeft}>
                  <Text style={s.subEmail}>{sub.email}</Text>
                  <Text style={s.subName}>{sub.full_name || 'No name'}</Text>
                </View>
                <View style={s.subRight}>
                  <View style={[s.roleBadge, sub.role === 'admin' ? s.roleAdmin : s.roleApproved]}>
                    <Text style={[s.roleText, { color: sub.role === 'admin' ? colors.gold : colors.green }]}>{sub.role?.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <View style={s.subActions}>
                <TouchableOpacity style={s.viewBtn} onPress={() => openDetail(sub)}>
                  <Text style={s.viewBtnText}>View Portfolio</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(sub.user_id, sub.email)}>
                  <Text style={s.delText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Portfolio Detail Modal */}
      <Modal visible={!!detailUser} transparent animationType="slide" onRequestClose={() => setDetailUser(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.modalTitle}>{detailUser?.full_name || 'Subscriber'}</Text>
                <Text style={s.modalSub}>{detailUser?.email}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailUser(null)}>
                <Text style={s.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {detailLoad ? (
              <ActivityIndicator color={colors.accent} style={{ paddingVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const st = statsFromTrades(detailTrades, detailExecs, detailPrices)
                  return (
                    <>
                      <View style={s.statsRow}>
                        <View style={s.statBox}>
                          <Text style={s.statLabel}>OPEN</Text>
                          <Text style={[s.statVal, { color: colors.accent }]}>{st.open}</Text>
                        </View>
                        <View style={s.statBox}>
                          <Text style={s.statLabel}>CLOSED</Text>
                          <Text style={s.statVal}>{st.closed}</Text>
                        </View>
                        <View style={s.statBox}>
                          <Text style={s.statLabel}>INVESTED</Text>
                          <Text style={s.statVal}>₹{fmt0(st.invested)}</Text>
                        </View>
                        <View style={s.statBox}>
                          <Text style={s.statLabel}>REALISED</Text>
                          <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                            {st.realised >= 0 ? '+' : '−'}₹{fmt0(Math.abs(st.realised))}
                          </Text>
                        </View>
                      </View>
                      {st.hasLive && (
                        <View style={[s.statsRow, { marginTop: -spacing.sm }]}>
                          <View style={[s.statBox, { flex: 1 }]}>
                            <Text style={s.statLabel}>UNREALISED</Text>
                            <Text style={[s.statVal, { color: st.unrealised >= 0 ? colors.green : colors.red }]}>
                              {st.unrealised >= 0 ? '+' : '−'}₹{fmt0(Math.abs(st.unrealised))}
                            </Text>
                          </View>
                        </View>
                      )}
                    </>
                  )
                })()}

                {detailTrades.length === 0 ? (
                  <Text style={s.noTrades}>No trades found</Text>
                ) : (
                  detailTrades.slice(0, 30).map(t => {
                    const tExecs  = detailExecs.filter((e: any) => e.trade_id === t.id)
                    const soldQty = tExecs.reduce((s: number, e: any) => s + Number(e.quantity || 0), 0)
                    const currQty = Math.max(0, Number(t.quantity) - soldQty)
                    const cmp     = t.status === 'OPEN' ? detailPrices[t.ticker] : null
                    const uPnl    = (cmp && currQty > 0)
                      ? (t.direction === 'SHORT'
                          ? (Number(t.entry_price) - cmp) * currQty
                          : (cmp - Number(t.entry_price)) * currQty)
                      : null
                    const rPnl = tExecs.reduce((s: number, e: any) =>
                      s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
                    return (
                      <View key={t.id} style={[s.tradeRow, t.status === 'OPEN' ? s.tradeOpen : s.tradeClosed]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.tradeTicker}>{t.ticker}</Text>
                            <Text style={[s.tradeDir, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>{t.direction}</Text>
                          </View>
                          <Text style={s.tradeMeta}>
                            {t.entry_date?.slice(0, 10)} · {t.account || ''} · Qty {currQty}/{t.quantity}
                          </Text>
                          {uPnl !== null && (
                            <Text style={[s.tradeMeta, { color: uPnl >= 0 ? colors.green : colors.red, fontWeight: '700' }]}>
                              {uPnl >= 0 ? '+' : '−'}₹{fmt0(Math.abs(uPnl))} Unreal
                            </Text>
                          )}
                          {rPnl !== 0 && (
                            <Text style={[s.tradeMeta, { color: rPnl >= 0 ? colors.green : colors.red, fontWeight: '700' }]}>
                              {rPnl >= 0 ? '+' : '−'}₹{fmt0(Math.abs(rPnl))} Real
                            </Text>
                          )}
                        </View>
                        <View style={s.tradeRight}>
                          <Text style={[s.tradeStatus, { color: t.status === 'OPEN' ? colors.accent : colors.muted }]}>{t.status}</Text>
                          <Text style={s.tradeInvested}>₹{fmt0(t.invested_capital || 0)}</Text>
                        </View>
                      </View>
                    )
                  })
                )}
              </ScrollView>
            )}
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

  section:      { marginBottom: spacing.lg },
  sectionTitle: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: spacing.sm },

  pendingCard: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.md },
  userEmail:   { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  userMeta:    { fontSize: font.size.sm, color: colors.muted, marginTop: 2 },
  pendingBtns: { flexDirection: 'row', gap: spacing.sm },
  approveBtn:  { flex: 1, backgroundColor: colors.green, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' },
  approveBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.sm },
  denyBtn:     { flex: 1, borderWidth: 1, borderColor: colors.red, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' },
  denyBtnText: { color: colors.red, fontWeight: '700', fontSize: font.size.sm },

  subCard:  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  subHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  subLeft:  {},
  subEmail: { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  subName:  { fontSize: font.size.sm, color: colors.muted, marginTop: 2 },
  subRight: {},
  roleBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  roleAdmin:  { backgroundColor: '#fef9c3', borderColor: '#fde68a' },
  roleApproved: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  roleText:   { fontSize: font.size.xs, fontWeight: '700' },
  subActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewBtn:    { borderWidth: 1, borderColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: 6 },
  viewBtnText:{ color: colors.accent, fontSize: font.size.sm, fontWeight: '700' },
  delText:    { fontSize: font.size.sm, color: colors.red, fontWeight: '600' },

  emptyBox:  { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:  { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '88%', paddingBottom: 40 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  modalTitle:{ fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  modalSub:  { fontSize: font.size.sm, color: colors.muted, marginTop: 2 },
  closeBtn:  { fontSize: font.size.xl, color: colors.muted, padding: spacing.xs },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox:  { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statLabel:{ fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 },
  statVal:  { fontSize: font.size.md, fontWeight: '800', color: colors.text, marginTop: 4 },

  noTrades:  { textAlign: 'center', color: colors.muted, paddingVertical: spacing.xl },
  tradeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeOpen: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  tradeClosed:{ borderLeftWidth: 3, borderLeftColor: colors.border2 },
  tradeTicker:{ fontSize: font.size.md, fontWeight: '800', color: colors.text },
  tradeMeta: { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  tradeRight:{ alignItems: 'flex-end' },
  tradeDir:  { fontSize: font.size.xs, fontWeight: '700', color: colors.muted },
  tradeStatus:{ fontSize: font.size.xs, fontWeight: '700' },
  tradeInvested:{ fontSize: font.size.sm, color: colors.text, fontWeight: '600' },
})
