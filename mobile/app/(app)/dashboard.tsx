import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { getTrades, getBankAccounts, getPriceAlerts } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmt0 = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const fmtd = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtMoney = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10_000_000) return `₹${(a / 10_000_000).toFixed(2)} Cr`
  if (a >= 100_000)    return `₹${(a / 100_000).toFixed(2)} L`
  return `₹${fmt0(a)}`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const sc = StyleSheet.create({
  card: {
    width: 142,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: font.size.xs, fontWeight: '700', color: colors.muted,
    letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  value: { fontSize: font.size.h2, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub:   { fontSize: font.size.xs, color: colors.muted },
})

function StatCard({
  label, value, sub, valueColor,
}: {
  label: string; value: string; sub?: string; valueColor?: string
}) {
  return (
    <View style={sc.card}>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  )
}

export default function DashboardScreen() {
  const { session } = useAuth()
  const [trades,     setTrades]     = useState<any[]>([])
  const [banks,      setBanks]      = useState<any[]>([])
  const [alerts,     setAlerts]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, b, a] = await Promise.all([getTrades(), getBankAccounts(), getPriceAlerts()])
      setTrades(Array.isArray(t) ? t : [])
      setBanks(Array.isArray(b) ? b : [])
      setAlerts(Array.isArray(a) ? a : [])
    } catch { /* show empty state on error */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const open   = trades.filter(t => t.status === 'OPEN')
  const closed = trades.filter(t => t.status === 'CLOSED')

  const realizedPnL = closed.reduce((sum, t) => {
    const sign = t.direction === 'LONG' ? 1 : -1
    return sum + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
  }, 0)

  const winners = closed.filter(t => {
    const sign = t.direction === 'LONG' ? 1 : -1
    return sign * (Number(t.exit_price || 0) - Number(t.entry_price)) > 0
  })
  const winRate  = closed.length > 0 ? (winners.length / closed.length) * 100 : 0
  const invested = open.reduce((sum, t) => sum + Number(t.invested_capital || 0), 0)
  const bankBal  = banks.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  const activeAl = alerts.filter(a => a.status === 'ACTIVE').length

  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'CHiiRAG'
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load() }}
          tintColor={colors.accent}
        />
      }
    >
      {/* Greeting */}
      <View style={s.greetCard}>
        <Text style={s.greetHi}>{getGreeting()}, {userName}!</Text>
        <Text style={s.greetDate}>{today}</Text>
      </View>

      {/* Portfolio Overview — scrollable stat cards */}
      <Text style={s.sectionTitle}>PORTFOLIO OVERVIEW</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.statRow}
        decelerationRate="fast"
      >
        <StatCard
          label="OPEN TRADES"
          value={String(open.length)}
          sub={open.length === 1 ? 'position' : 'positions'}
          valueColor={open.length > 0 ? colors.accent : colors.muted}
        />
        <StatCard
          label="CAPITAL DEPLOYED"
          value={fmtMoney(invested)}
        />
        <StatCard
          label="REALIZED P&L"
          value={(realizedPnL >= 0 ? '+' : '−') + fmtMoney(realizedPnL)}
          sub={`${closed.length} closed`}
          valueColor={realizedPnL >= 0 ? colors.green : colors.red}
        />
        <StatCard
          label="WIN RATE"
          value={closed.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
          sub={`${winners.length} / ${closed.length} wins`}
          valueColor={
            closed.length === 0 ? colors.muted
              : winRate >= 50 ? colors.green
              : colors.red
          }
        />
        <StatCard
          label="BANK BALANCE"
          value={fmtMoney(bankBal)}
          sub={`${banks.length} account${banks.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="ACTIVE ALERTS"
          value={String(activeAl)}
          sub={activeAl > 0 ? 'watching' : 'none set'}
          valueColor={activeAl > 0 ? colors.gold : colors.muted}
        />
      </ScrollView>

      {/* Open Positions preview */}
      <Text style={s.sectionTitle}>OPEN POSITIONS</Text>
      {open.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No open trades</Text>
          <Text style={s.emptySub}>Add trades from the web app</Text>
        </View>
      ) : (
        <>
          {open.slice(0, 5).map(t => (
            <View key={t.id} style={s.tradeCard}>
              <View style={s.tradeHead}>
                <Text style={s.tradeTicker}>{t.ticker}</Text>
                <View style={[s.badge, t.direction === 'LONG' ? s.bLong : s.bShort]}>
                  <Text style={[s.badgeText, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>
                    {t.direction}
                  </Text>
                </View>
              </View>

              <View style={s.tradeStats}>
                <View style={s.tradeStat}>
                  <Text style={s.tradeStatLabel}>ENTRY</Text>
                  <Text style={s.tradeStatValue}>₹{fmtd(t.entry_price)}</Text>
                </View>
                <View style={s.tradeStat}>
                  <Text style={s.tradeStatLabel}>QTY</Text>
                  <Text style={s.tradeStatValue}>{fmt0(t.quantity)}</Text>
                </View>
                <View style={s.tradeStat}>
                  <Text style={s.tradeStatLabel}>INVESTED</Text>
                  <Text style={s.tradeStatValue}>{fmtMoney(t.invested_capital || 0)}</Text>
                </View>
              </View>

              <View style={s.tradeFoot}>
                <Text style={s.tradeDate}>{t.entry_date?.slice(0, 10)}</Text>
                {t.account ? <Text style={s.tradeAcct}>{t.account}</Text> : null}
              </View>
            </View>
          ))}
          {open.length > 5 && (
            <Text style={s.moreHint}>+{open.length - 5} more — view in All Trades</Text>
          )}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  page:      { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: 120 },

  greetCard: {
    backgroundColor:  colors.surface,
    borderWidth:      1,
    borderColor:      colors.border,
    borderRadius:     radius.lg,
    borderTopWidth:   4,
    borderTopColor:   colors.saffron,
    padding:          spacing.xl,
    marginBottom:     spacing.lg,
  },
  greetHi:   { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  greetDate: { fontSize: font.size.sm, color: colors.muted, marginTop: 4 },

  sectionTitle: {
    fontSize:     font.size.xs,
    fontWeight:   '700',
    color:        colors.muted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop:    spacing.md,
  },

  statRow: {
    paddingVertical: spacing.sm,
    paddingRight:    spacing.lg,
    marginBottom:    spacing.md,
  },

  tradeCard: {
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
  },
  tradeHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  tradeTicker:    { fontSize: font.size.h2, fontWeight: '800', color: colors.text },
  badge:          { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  bLong:          { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  bShort:         { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  badgeText:      { fontSize: font.size.xs, fontWeight: '700' },
  tradeStats:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tradeStat:      { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm },
  tradeStatLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '600', marginBottom: 3 },
  tradeStatValue: { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  tradeFoot:      { flexDirection: 'row', justifyContent: 'space-between' },
  tradeDate:      { fontSize: font.size.sm, color: colors.muted },
  tradeAcct:      { fontSize: font.size.sm, color: colors.accent, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },
  emptySub:  { fontSize: font.size.md, color: colors.muted, marginTop: spacing.sm },
  moreHint:  { fontSize: font.size.sm, color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
})
