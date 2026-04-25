import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { getTrades, getExecutions, getStockPrice } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Full-width stat card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTricolor} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  )
}

function OpenRow({ trade, livePrice, executions }: any) {
  const execs = executions || []
  const soldQty = execs.reduce((s: number, e: any) => s + Number(e.quantity), 0)
  const qty = Math.max(0, Number(trade.quantity) - soldQty)
  const cmp = livePrice?.price
  const change = livePrice?.changePercent
  const unr = cmp && qty > 0
    ? (trade.direction === 'SHORT'
        ? (Number(trade.entry_price) - cmp) * qty
        : (cmp - Number(trade.entry_price)) * qty)
    : null
  const isProfit = unr !== null && unr >= 0

  return (
    <View style={styles.openRow}>
      <View style={styles.openTop}>
        <Text style={styles.openTicker}>{trade.ticker}</Text>
        <View style={[styles.dirBadge, trade.direction === 'LONG' ? styles.longBadge : styles.shortBadge]}>
          <Text style={[styles.dirText, { color: trade.direction === 'LONG' ? colors.green : colors.red }]}>
            {trade.direction}
          </Text>
        </View>
      </View>
      <Text style={styles.openAccount}>{trade.account}</Text>
      <View style={styles.openStats}>
        <View style={styles.openStat}>
          <Text style={styles.openStatLabel}>ENTRY</Text>
          <Text style={styles.openStatVal}>₹{fmtd(trade.entry_price)}</Text>
        </View>
        <View style={styles.openStat}>
          <Text style={styles.openStatLabel}>CMP</Text>
          <Text style={styles.openStatVal}>{cmp ? `₹${fmtd(cmp)}` : '—'}</Text>
          {change != null && (
            <Text style={[styles.openChange, { color: change >= 0 ? colors.bull : colors.bear }]}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </Text>
          )}
        </View>
        <View style={styles.openStat}>
          <Text style={styles.openStatLabel}>UNREALISED</Text>
          {unr !== null ? (
            <Text style={[styles.openStatVal, { color: isProfit ? colors.bull : colors.bear, fontWeight: '700' }]}>
              {isProfit ? '+' : '−'}₹{fmt(Math.abs(unr))}
            </Text>
          ) : (
            <Text style={[styles.openStatVal, { color: colors.muted }]}>—</Text>
          )}
        </View>
      </View>
    </View>
  )
}

function ExitRow({ ticker, account, date, pnl }: any) {
  const isProfit = pnl >= 0
  return (
    <View style={[styles.exitRow, { borderLeftColor: isProfit ? colors.bull : colors.bear }]}>
      <View>
        <Text style={styles.exitTicker}>{ticker}</Text>
        <Text style={styles.exitSub}>{account} · {date?.slice(0, 10)}</Text>
      </View>
      <Text style={[styles.exitPnl, { color: isProfit ? colors.bull : colors.bear }]}>
        {isProfit ? '+' : '−'}₹{fmtd(Math.abs(pnl))}
      </Text>
    </View>
  )
}

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

      const results = await Promise.all(
        data.map((t: any) => getExecutions(t.id).catch(() => []))
      )
      const map: Record<string, any[]> = {}
      data.forEach((t: any, i: number) => { map[t.id] = Array.isArray(results[i]) ? results[i] : [] })
      setExecMap(map)

      const tickers = [...new Set(data.filter((t: any) => t.status === 'OPEN').map((t: any) => t.ticker))] as string[]
      tickers.forEach(async (ticker) => {
        try {
          const d = await getStockPrice(ticker)
          if (d?.price) setLivePrices(prev => ({ ...prev, [ticker]: d }))
        } catch {}
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const allExecs     = Object.values(execMap).flat()
  const openTrades   = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  const totalRealised = trades.reduce((sum, t) => {
    const execs = allExecs.filter(e => e.trade_id === t.id)
    return sum + execs.reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
  }, 0)

  const totalUnrealised = openTrades.reduce((sum, t) => {
    const cmp = livePrices[t.ticker]?.price; if (!cmp) return sum
    const soldQty = allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + Number(e.quantity), 0)
    const qty = Math.max(0, Number(t.quantity) - soldQty)
    return sum + (t.direction === 'SHORT' ? (Number(t.entry_price) - cmp) * qty : (cmp - Number(t.entry_price)) * qty)
  }, 0)

  const wins = closedTrades.filter(t => {
    const r = allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
    return r > 0
  })
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length * 100).toFixed(1) : '0.0'
  const totalInvested = openTrades.reduce((s, t) => s + (Number(t.actual_investment) || Number(t.invested_capital) || 0), 0)

  const totalMtf = trades.reduce((s, t) => {
    if (!t.mtf_interest_rate || !t.entry_date) return s
    const totalVal = Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity))
    const margin = Number(t.actual_investment) || 0
    const base = margin > 0 ? totalVal - margin : totalVal
    if (base <= 0) return s
    const end = t.status === 'CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
    const diffDays = Math.max(1, Math.floor((end.getTime() - new Date(t.entry_date).getTime()) / 86400000))
    return s + (base * t.mtf_interest_rate * diffDays) / 36500
  }, 0)

  const tradesWithPnl = trades.map(t => ({
    ...t,
    _realised: allExecs.filter(e => e.trade_id === t.id).reduce((s, e) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
  }))

  const recentExits = [...tradesWithPnl]
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => new Date(b.exit_date || b.updated_at).getTime() - new Date(a.exit_date || a.updated_at).getTime())
    .slice(0, 6)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true) }}
          tintColor={colors.accent}
        />
      }
    >
      {/* Tricolor bar */}
      <View style={styles.tricolor} />

      {/* P&L Hero Cards — 2 big ones side by side */}
      <View style={styles.heroRow}>
        <View style={[styles.heroCard, { borderColor: totalUnrealised >= 0 ? '#bae6fd' : '#fecaca' }]}>
          <Text style={styles.heroLabel}>UNREALISED P&L</Text>
          <Text style={[styles.heroValue, { color: totalUnrealised >= 0 ? colors.bull : colors.bear }]}>
            {totalUnrealised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(totalUnrealised))}
          </Text>
          <Text style={styles.heroSub}>{openTrades.length} open positions</Text>
        </View>
        <View style={[styles.heroCard, { borderColor: totalRealised >= 0 ? '#bae6fd' : '#fecaca' }]}>
          <Text style={styles.heroLabel}>REALISED P&L</Text>
          <Text style={[styles.heroValue, { color: totalRealised >= 0 ? colors.bull : colors.bear }]}>
            {totalRealised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(totalRealised))}
          </Text>
          <Text style={styles.heroSub}>{closedTrades.length} closed trades</Text>
        </View>
      </View>

      {/* Stats grid — 2x2 */}
      <View style={styles.statsGrid}>
        <StatCard label="WIN RATE"       value={`${winRate}%`}          color={colors.accent}  sub={`${wins.length}W · ${closedTrades.length - wins.length}L`} />
        <StatCard label="OPEN POSITIONS" value={`${openTrades.length}`}                        sub={`₹${fmt(totalInvested)} deployed`} />
        <StatCard label="MTF INTEREST"   value={`₹${fmtd(totalMtf)}`}   color={colors.gold}    sub="Accrued" />
        <StatCard label="TOTAL TRADES"   value={`${trades.length}`}                            sub={`${openTrades.length} open · ${closedTrades.length} closed`} />
      </View>

      {/* Open Positions */}
      {openTrades.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open Positions</Text>
            <View style={styles.countBadge}><Text style={styles.countText}>{openTrades.length}</Text></View>
          </View>
          {openTrades.map(t => (
            <OpenRow key={t.id} trade={t} livePrice={livePrices[t.ticker]} executions={execMap[t.id]} />
          ))}
        </View>
      )}

      {/* Recent Exits */}
      {recentExits.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>Recent Exits</Text>
          {recentExits.map(t => (
            <ExitRow key={t.id} ticker={t.ticker} account={t.account} date={t.exit_date} pnl={t._realised} />
          ))}
        </View>
      )}

      {trades.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyText}>No trades yet</Text>
          <Text style={styles.emptySub}>Add trades on the web app to see them here</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  content:   { padding: spacing.lg, paddingBottom: 120 },

  tricolor: { height: 4, backgroundColor: colors.saffron, marginBottom: spacing.lg, borderRadius: 2 },

  // Hero P&L cards
  heroRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  heroCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  heroLabel: { fontSize: font.size.xs, color: colors.muted, letterSpacing: 1, marginBottom: spacing.sm },
  heroValue: { fontSize: font.size.xxl, fontWeight: '800', marginBottom: spacing.xs },
  heroSub:   { fontSize: font.size.xs, color: colors.muted },

  // Stat grid — 2 columns
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  statTricolor: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.saffron },
  statLabel:    { fontSize: font.size.xs, color: colors.muted, letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  statValue:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text, lineHeight: 22 },
  statSub:      { fontSize: font.size.xs, color: colors.muted, marginTop: 4 },

  // Section
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle:  { fontSize: font.size.xl, fontWeight: '700', color: colors.text },
  countBadge:    { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  countText:     { fontSize: font.size.xs, color: colors.accent, fontWeight: '700' },

  // Open position row
  openRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  openTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  openTicker: { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  openAccount:{ fontSize: font.size.xs, color: colors.muted, marginBottom: spacing.sm },
  dirBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  longBadge:  { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  shortBadge: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  dirText:    { fontSize: font.size.xs, fontWeight: '700' },
  openStats:  { flexDirection: 'row', gap: spacing.sm },
  openStat:   { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm },
  openStatLabel: { fontSize: font.size.xs, color: colors.muted, marginBottom: 2 },
  openStatVal:   { fontSize: font.size.sm, color: colors.text, fontWeight: '600' },
  openChange:    { fontSize: font.size.xs, marginTop: 1 },

  // Exit row
  exitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingLeft: spacing.md,
    borderLeftWidth: 3,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exitTicker: { fontSize: font.size.lg, fontWeight: '700', color: colors.text },
  exitSub:    { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  exitPnl:    { fontSize: font.size.lg, fontWeight: '700' },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.lg },
  emptyText: { fontSize: font.size.xxl, fontWeight: '700', color: colors.border2, marginBottom: spacing.sm },
  emptySub:  { fontSize: font.size.md, color: colors.muted, textAlign: 'center' },
})
