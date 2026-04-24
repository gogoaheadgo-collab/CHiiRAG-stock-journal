import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { getTrades } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

type Trade = {
  id: string
  ticker: string
  account: string
  status: 'OPEN' | 'CLOSED'
  entry_price: number
  current_price?: number
  invested_capital: number
  strategy?: string
  entry_date: string
  unrealised_pnl?: number
  unrealised_pnl_pct?: number
}

export default function TradesScreen() {
  const [trades,     setTrades]     = useState<Trade[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter,     setFilter]     = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  const load = useCallback(async () => {
    try {
      const data = await getTrades()
      setTrades(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'ALL' ? trades : trades.filter(t => t.status === filter)
  const openCount   = trades.filter(t => t.status === 'OPEN').length
  const closedCount = trades.filter(t => t.status === 'CLOSED').length

  function renderTrade({ item: t }: { item: Trade }) {
    const isOpen = t.status === 'OPEN'
    const pnl    = t.unrealised_pnl || 0
    const pnlPct = t.unrealised_pnl_pct || 0
    const pnlColor = pnl >= 0 ? colors.green : colors.red
    const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.ticker}>{t.ticker}</Text>
            <Text style={styles.account}>{t.account}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isOpen ? colors.green + '22' : colors.textMuted + '22' }]}>
            <Text style={[styles.badgeText, { color: isOpen ? colors.green : colors.textMuted }]}>
              {t.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>BUY</Text>
            <Text style={styles.statVal}>₹{fmt(t.entry_price)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>INVESTED</Text>
            <Text style={styles.statVal}>₹{fmt(t.invested_capital)}</Text>
          </View>
          {isOpen && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>P&L</Text>
              <Text style={[styles.statVal, { color: pnlColor }]}>
                {pnl >= 0 ? '+' : ''}₹{fmt(pnl)}
              </Text>
              <Text style={[styles.statPct, { color: pnlColor }]}>
                {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>

        {t.strategy && (
          <Text style={styles.strategy}>{t.strategy}</Text>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* Summary bar */}
      <View style={styles.summary}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'ALL'    && styles.filterActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterText, filter === 'ALL' && styles.filterTextActive]}>
            ALL · {trades.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'OPEN'   && styles.filterActive]}
          onPress={() => setFilter('OPEN')}
        >
          <Text style={[styles.filterText, filter === 'OPEN' && styles.filterTextActive]}>
            OPEN · {openCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'CLOSED' && styles.filterActive]}
          onPress={() => setFilter('CLOSED')}
        >
          <Text style={[styles.filterText, filter === 'CLOSED' && styles.filterTextActive]}>
            CLOSED · {closedCount}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        renderItem={renderTrade}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trades found</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  summary: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterBtn: {
    flex: 1, paddingVertical: spacing.sm,
    alignItems: 'center', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  filterActive:     { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  filterText:       { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 1 },
  filterTextActive: { color: colors.accent },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  ticker:  { fontFamily: font.mono, fontSize: font.size.xl, fontWeight: font.weight.black, color: colors.textPrimary },
  account: { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  badge:   { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
  cardRow: { flexDirection: 'row', gap: spacing.sm },
  stat:    { flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.sm, padding: spacing.sm },
  statLabel: { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 1, marginBottom: 2 },
  statVal:   { fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.bold, color: colors.textPrimary },
  statPct:   { fontFamily: font.mono, fontSize: font.size.xs },
  strategy:  { fontFamily: font.mono, fontSize: font.size.xs, color: colors.accent, marginTop: spacing.sm },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: font.mono, fontSize: font.size.md, color: colors.textMuted },
})
