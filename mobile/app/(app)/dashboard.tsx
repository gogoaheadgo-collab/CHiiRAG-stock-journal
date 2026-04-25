import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { getTrades, getExecutions, getStockPrice } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'


const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Stat Card (matches web .stat-card exactly) ────────────────────────────────
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

// ── Recent Exit Row ───────────────────────────────────────────────────────────
function ExitRow({ ticker, account, date, pnl }: any) {
  const isProfit = pnl >= 0
  return (
    <View style={[styles.exitRow, { borderLeftColor: isProfit ? colors.bull : colors.bear }]}>
      <View>
        <Text style={styles.exitTicker}>{ticker}</Text>
        <Text style={styles.exitSub}>{account} · {date?.slice(0, 10)}</Text>
      </View>
      <Text style={[styles.exitPnl, { color: isProfit ? colors.bull : colors.bear }]}>
        {isProfit ? '+' : '−'}Rs.{fmtd(Math.abs(pnl))}
      </Text>
    </View>
  )
}

// ── Open Position Row ─────────────────────────────────────────────────────────
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
      <View style={styles.openLeft}>
        <Text style={styles.openTicker}>{trade.ticker}</Text>
        <Text style={styles.openAccount}>{trade.account}</Text>
      </View>
      <View style={styles.openMid}>
        <Text style={styles.openEntry}>Rs.{fmtd(trade.entry_price)}</Text>
        {cmp && <Text style={styles.openCmp}>Rs.{fmtd(cmp)}</Text>}
        {change != null && (
          <Text style={[styles.openChange, { color: change >= 0 ? colors.bull : colors.bear }]}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </Text>
        )}
      </View>
      <View style={styles.openRight}>
        {unr !== null ? (
          <Text style={[styles.openUnr, { color: isProfit ? colors.bull : colors.bear }]}>
            {isProfit ? '+' : '−'}Rs.{fmt(Math.abs(unr))}
          </Text>
        ) : (
          <Text style={[styles.openUnr, { color: colors.muted }]}>—</Text>
        )}
        <Text style={styles.openQty}>{fmt(qty)} qty</Text>
      </View>
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

      // Load executions for all trades
      const results = await Promise.all(
        data.map((t: any) => getExecutions(t.id).catch(() => []))
      )
      const map: Record<string, any[]> = {}
      data.forEach((t: any, i: number) => { map[t.id] = Array.isArray(results[i]) ? results[i] : [] })
      setExecMap(map)

      // Live prices for open trades
      const tickers = [...new Set(data.filter((t: any) => t.status === 'OPEN').map((t: any) => t.ticker))]
      tickers.forEach(async (ticker: any) => {
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

  const allExecs    = Object.values(execMap).flat()
  const openTrades  = trades.filter(t => t.status === 'OPEN')
  const closedTrades = trades.filter(t => t.status === 'CLOSED')

  // P&L calculations
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

  // MTF Interest
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

  // Trades with realised for recent exits
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
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={colors.accent} />}
    >
      {/* India flag tricolor bar */}
      <View style={styles.tricolor} />

      {/* Stat Cards — 2x3 grid */}
      <View style={styles.statGrid}>
        <StatCard
          label="Unrealised P&L"
          value={`${totalUnrealised >= 0 ? '+' : '−'}Rs.${fmtd(Math.abs(totalUnrealised))}`}
          color={totalUnrealised >= 0 ? colors.bull : colors.bear}
          sub={`${openTrades.length} open positions`}
        />
        <StatCard
          label="Realised P&L"
          value={`${totalRealised >= 0 ? '+' : '−'}Rs.${fmtd(Math.abs(totalRealised))}`}
          color={totalRealised >= 0 ? colors.bull : colors.bear}
          sub={`${closedTrades.length} closed trades`}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          color={colors.accent}
          sub={`${wins.length}W · ${closedTrades.length - wins.length}L`}
        />
        <StatCard
          label="Open Positions"
          value={`${openTrades.length}`}
          sub={`Rs.${fmt(totalInvested)} deployed`}
        />
        <StatCard
          label="MTF Interest"
          value={`Rs.${fmtd(totalMtf)}`}
          color={colors.gold}
          sub="Accrued"
        />
        <StatCard
          label="Total Trades"
          value={`${trades.length}`}
          sub={`${openTrades.length} open · ${closedTrades.length} closed`}
        />
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
          <Text style={styles.sectionTitle}>Recent Exits</Text>
          {recentExits.map(t => (
            <ExitRow key={t.id} ticker={t.ticker} account={t.account} date={t.exit_date} pnl={t._realised} />
          ))}
        </View>
      )}

      {trades.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No trades yet</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  tricolor:  { height: 3, backgroundColor: colors.saffron, marginBottom: spacing.lg, borderRadius: 2 },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...shadow.sm,
  },
  statTricolor: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: colors.saffron,
  },
  statLabel: {
    fontFamily: 'DMmono',
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 6,
    marginTop: 4,
  },
  statValue: {
    fontFamily: 'LibreBaskervilleBold',
    fontSize: font.size.h2,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  statSub: {
    fontFamily: 'DMmono',
    fontSize: font.size.xs,
    color: colors.muted,
    marginTop: 4,
  },

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
  sectionTitle: {
    fontFamily: 'LibreBaskervilleBold',
    fontSize: font.size.lg,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.sm,
  },
  countText: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.accent, fontWeight: '700' },

  // Open row
  openRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  openLeft:    { flex: 1 },
  openTicker:  { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.lg, color: colors.text },
  openAccount: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  openMid:     { flex: 1, alignItems: 'center' },
  openEntry:   { fontFamily: 'DMmono', fontSize: font.size.sm, color: colors.muted },
  openCmp:     { fontFamily: 'DMmono', fontSize: font.size.md, fontWeight: '700', color: colors.text },
  openChange:  { fontFamily: 'DMmono', fontSize: font.size.xs },
  openRight:   { flex: 1, alignItems: 'flex-end' },
  openUnr:     { fontFamily: 'DMmono', fontSize: font.size.md, fontWeight: '700' },
  openQty:     { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },

  // Exit row
  exitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exitTicker: { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.lg, color: colors.text },
  exitSub:    { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  exitPnl:    { fontFamily: 'DMmono', fontSize: font.size.md, fontWeight: '700' },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'LibreBaskerville', fontSize: font.size.xxl, color: colors.border2 },
})
