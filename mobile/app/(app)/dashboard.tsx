import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { getTrades, getExecutions, getStockPrice } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function DashboardScreen() {
  const [trades,     setTrades]     = useState<any[]>([])
  const [execMap,    setExecMap]    = useState<Record<string, any[]>>({})
  const [livePrices, setLivePrices] = useState<Record<string, any>>({})
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getTrades()
      if (!Array.isArray(data)) return
      setTrades(data)
      const results = await Promise.all(data.map((t: any) => getExecutions(t.id).catch(() => [])))
      const map: Record<string, any[]> = {}
      data.forEach((t: any, i: number) => { map[t.id] = Array.isArray(results[i]) ? results[i] : [] })
      setExecMap(map)
      const tickers = [...new Set(data.filter((t: any) => t.status === 'OPEN').map((t: any) => t.ticker))] as string[]
      tickers.forEach(async (ticker) => {
        try { const d = await getStockPrice(ticker); if (d?.price) setLivePrices(p => ({ ...p, [ticker]: d })) } catch {}
      })
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const allExecs     = Object.values(execMap).flat()
  const openTrades   = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  const totalRealised = trades.reduce((sum, t) => {
    return sum + allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
  }, 0)

  const totalUnrealised = openTrades.reduce((sum, t) => {
    const cmp = livePrices[t.ticker]?.price; if (!cmp) return sum
    const sold = allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + Number(e.quantity), 0)
    const qty  = Math.max(0, Number(t.quantity) - sold)
    return sum + (t.direction === 'SHORT' ? (Number(t.entry_price) - cmp) * qty : (cmp - Number(t.entry_price)) * qty)
  }, 0)

  const wins = closedTrades.filter(t =>
    allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0) > 0
  )
  const winRate       = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100).toFixed(1) : '0.0'
  const totalInvested = openTrades.reduce((s, t) => s + (Number(t.actual_investment) || Number(t.invested_capital) || 0), 0)

  const totalMtf = trades.reduce((s, t) => {
    if (!t.mtf_interest_rate || !t.entry_date) return s
    const base = (Number(t.invested_capital) || 0) - (Number(t.actual_investment) || 0)
    if (base <= 0) return s
    const end  = t.status === 'CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
    const days = Math.max(1, Math.floor((end.getTime() - new Date(t.entry_date).getTime()) / 86400000))
    return s + (base * t.mtf_interest_rate * days) / 36500
  }, 0)

  const recentExits = trades
    .filter(t => t.status === 'CLOSED')
    .map(t => ({
      ...t,
      _pnl: allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    }))
    .sort((a, b) => new Date(b.exit_date || b.updated_at).getTime() - new Date(a.exit_date || a.updated_at).getTime())
    .slice(0, 5)

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={colors.accent} />}
    >
      {/* India flag tricolor */}
      <View style={s.tricolor} />

      {/* Unrealised P&L — hero card full width */}
      <View style={[s.heroCard, { borderLeftColor: totalUnrealised >= 0 ? colors.bull : colors.bear }]}>
        <Text style={s.heroLabel}>UNREALISED P&L</Text>
        <Text style={[s.heroValue, { color: totalUnrealised >= 0 ? colors.bull : colors.bear }]}>
          {totalUnrealised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(totalUnrealised))}
        </Text>
        <Text style={s.heroSub}>{openTrades.length} open positions · ₹{fmt(totalInvested)} deployed</Text>
      </View>

      {/* Realised P&L — full width */}
      <View style={[s.heroCard, { borderLeftColor: totalRealised >= 0 ? colors.bull : colors.bear }]}>
        <Text style={s.heroLabel}>REALISED P&L</Text>
        <Text style={[s.heroValue, { color: totalRealised >= 0 ? colors.bull : colors.bear }]}>
          {totalRealised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(totalRealised))}
        </Text>
        <Text style={s.heroSub}>{closedTrades.length} closed trades</Text>
      </View>

      {/* 2-col stats — win rate + MTF */}
      <View style={s.row}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>WIN RATE</Text>
          <Text style={[s.statValue, { color: colors.accent }]}>{winRate}%</Text>
          <Text style={s.statSub}>{wins.length}W · {closedTrades.length - wins.length}L</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>MTF INTEREST</Text>
          <Text style={[s.statValue, { color: colors.gold }]}>₹{fmtd(totalMtf)}</Text>
          <Text style={s.statSub}>Accrued</Text>
        </View>
      </View>

      {/* Open positions */}
      {openTrades.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Open Positions</Text>
            <View style={s.badge}><Text style={s.badgeText}>{openTrades.length}</Text></View>
          </View>
          {openTrades.map(t => {
            const cmp    = livePrices[t.ticker]?.price
            const chg    = livePrices[t.ticker]?.changePercent
            const sold   = allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + Number(e.quantity), 0)
            const qty    = Math.max(0, Number(t.quantity) - sold)
            const unr    = cmp && qty > 0 ? (t.direction === 'SHORT' ? (Number(t.entry_price) - cmp) * qty : (cmp - Number(t.entry_price)) * qty) : null
            return (
              <View key={t.id} style={s.tradeRow}>
                <View style={s.tradeLeft}>
                  <View style={s.tradeTopRow}>
                    <Text style={s.tradeTicker}>{t.ticker}</Text>
                    <View style={[s.dirBadge, t.direction === 'LONG' ? s.longBadge : s.shortBadge]}>
                      <Text style={[s.dirText, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>{t.direction}</Text>
                    </View>
                  </View>
                  <Text style={s.tradeAccount}>{t.account}</Text>
                  <Text style={s.tradeEntry}>Entry ₹{fmtd(t.entry_price)} · {fmt(qty)} qty</Text>
                </View>
                <View style={s.tradeRight}>
                  {cmp ? (
                    <>
                      <Text style={s.tradeCmp}>₹{fmtd(cmp)}</Text>
                      {chg != null && <Text style={[s.tradeChg, { color: chg >= 0 ? colors.bull : colors.bear }]}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</Text>}
                    </>
                  ) : <Text style={s.tradeMuted}>—</Text>}
                  {unr !== null && (
                    <Text style={[s.tradeUnr, { color: unr >= 0 ? colors.bull : colors.bear }]}>
                      {unr >= 0 ? '+' : '−'}₹{fmt(Math.abs(unr))}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* Recent exits */}
      {recentExits.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginBottom: spacing.md }]}>Recent Exits</Text>
          {recentExits.map(t => (
            <View key={t.id} style={[s.exitRow, { borderLeftColor: t._pnl >= 0 ? colors.bull : colors.bear }]}>
              <View>
                <Text style={s.exitTicker}>{t.ticker}</Text>
                <Text style={s.exitSub}>{t.account} · {t.exit_date?.slice(0, 10)}</Text>
              </View>
              <Text style={[s.exitPnl, { color: t._pnl >= 0 ? colors.bull : colors.bear }]}>
                {t._pnl >= 0 ? '+' : '−'}₹{fmtd(Math.abs(t._pnl))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  content:   { padding: spacing.lg, paddingBottom: 120 },
  tricolor:  { height: 4, backgroundColor: colors.saffron, marginBottom: spacing.lg, borderRadius: 2 },

  // Hero cards — full width, left border colored
  heroCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, borderRadius: radius.lg,
    padding: spacing.xl, marginBottom: spacing.md,
  },
  heroLabel: { fontSize: font.size.sm, color: colors.muted, letterSpacing: 1, fontWeight: '600', marginBottom: spacing.sm },
  heroValue: { fontSize: font.size.h1, fontWeight: '800', marginBottom: spacing.xs },
  heroSub:   { fontSize: font.size.sm, color: colors.muted },

  // 2-col stat row
  row:      { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },
  statLabel: { fontSize: font.size.sm, color: colors.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing.sm },
  statValue: { fontSize: font.size.h2, fontWeight: '800', marginBottom: 4 },
  statSub:   { fontSize: font.size.xs, color: colors.muted },

  // Section
  section:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle:{ fontSize: font.size.xl, fontWeight: '700', color: colors.text },
  badge:       { backgroundColor: colors.accentDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: font.size.xs, color: colors.accent, fontWeight: '700' },

  // Trade row
  tradeRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeLeft:   { flex: 1, marginRight: spacing.md },
  tradeTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  tradeTicker: { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  tradeAccount:{ fontSize: font.size.xs, color: colors.muted, marginBottom: 4 },
  tradeEntry:  { fontSize: font.size.sm, color: colors.muted },
  dirBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  longBadge:   { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  shortBadge:  { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  dirText:     { fontSize: font.size.xs, fontWeight: '700' },
  tradeRight:  { alignItems: 'flex-end', justifyContent: 'center' },
  tradeCmp:    { fontSize: font.size.lg, fontWeight: '700', color: colors.text },
  tradeChg:    { fontSize: font.size.sm, marginTop: 2 },
  tradeMuted:  { fontSize: font.size.lg, color: colors.muted },
  tradeUnr:    { fontSize: font.size.md, fontWeight: '700', marginTop: 4 },

  // Exit row
  exitRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, paddingLeft: spacing.md, borderLeftWidth: 3, borderBottomWidth: 1, borderBottomColor: colors.border },
  exitTicker: { fontSize: font.size.lg, fontWeight: '700', color: colors.text },
  exitSub:    { fontSize: font.size.sm, color: colors.muted, marginTop: 3 },
  exitPnl:    { fontSize: font.size.lg, fontWeight: '700' },
})
