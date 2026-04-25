import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native'
import { getTrades } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

type Filter = 'ALL' | 'OPEN' | 'CLOSED'

export default function TradesScreen() {
  const [trades,     setTrades]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter,     setFilter]     = useState<Filter>('ALL')
  const [search,     setSearch]     = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getTrades()
      setTrades(Array.isArray(data) ? data : [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = trades
    .filter(t => filter === 'ALL' || t.status === filter)
    .filter(t => search === '' || t.ticker.toUpperCase().includes(search.toUpperCase()) || t.account?.toUpperCase().includes(search.toUpperCase()))

  function renderTrade({ item: t }: { item: any }) {
    const isOpen = t.status === 'OPEN'
    return (
      <View style={styles.card}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.ticker}>{t.ticker}</Text>
            <Text style={styles.account}>{t.account}</Text>
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={[styles.badgeText, { color: isOpen ? colors.accent2 : colors.muted }]}>
                {t.status}
              </Text>
            </View>
            <View style={[styles.badge, t.direction === 'LONG' ? styles.badgeLong : styles.badgeShort]}>
              <Text style={[styles.badgeText, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>
                {t.direction}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>ENTRY Rs.</Text>
            <Text style={styles.statVal}>{fmtd(t.entry_price)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>QTY</Text>
            <Text style={styles.statVal}>{fmt(t.quantity)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>INVESTED</Text>
            <Text style={styles.statVal}>Rs.{fmt(t.invested_capital || 0)}</Text>
          </View>
          {!isOpen && t.exit_price && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>EXIT Rs.</Text>
              <Text style={styles.statVal}>{fmtd(t.exit_price)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {t.entry_date?.slice(0, 10)}{t.exit_date ? ` → ${t.exit_date.slice(0, 10)}` : ''}
          </Text>
          {t.strategy && (
            <View style={styles.strategyChip}>
              <Text style={styles.strategyText}>{t.strategy}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={styles.container}>
      {/* Filter + Search bar */}
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(['ALL', 'OPEN', 'CLOSED'] as Filter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.tab, filter === f && styles.tabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search ticker..."
          placeholderTextColor={colors.muted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        renderItem={renderTrade}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No trades found</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  toolbar: {
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  filters: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  tabActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:       { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, letterSpacing: 0.5 },
  tabTextActive: { color: colors.white, fontWeight: '700' },

  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontFamily: 'DMmono', fontSize: font.size.md,
    color: colors.text,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  ticker:  { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.xl, color: colors.text },
  account: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  badges:  { flexDirection: 'row', gap: spacing.xs },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  badgeOpen:   { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  badgeClosed: { backgroundColor: colors.surface2,  borderColor: colors.border },
  badgeLong:   { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  badgeShort:  { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  badgeText:   { fontFamily: 'DMmono', fontSize: font.size.xs, fontWeight: '700', letterSpacing: 0.3 },

  statsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  stat:     { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm },
  statLabel:{ fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, letterSpacing: 0.5, marginBottom: 2 },
  statVal:  { fontFamily: 'DMmono', fontSize: font.size.sm, color: colors.text, fontWeight: '700' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText:   { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted },
  strategyChip: { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  strategyText: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.accent, fontWeight: '700' },

  emptyText: { fontFamily: 'LibreBaskerville', fontSize: font.size.xxl, color: colors.border2 },
})
