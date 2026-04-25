import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native'
import { getTrades } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

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
    try { const data = await getTrades(); setTrades(Array.isArray(data) ? data : []) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = trades
    .filter(t => filter === 'ALL' || t.status === filter)
    .filter(t => !search || t.ticker.toUpperCase().includes(search.toUpperCase()) || (t.account || '').toUpperCase().includes(search.toUpperCase()))

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.filters}>
          {(['ALL', 'OPEN', 'CLOSED'] as Filter[]).map(f => (
            <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)}>
              <Text style={[s.tabText, filter === f && s.tabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search ticker or account..."
          placeholderTextColor={colors.muted}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        renderItem={({ item: t }) => {
          const isOpen = t.status === 'OPEN'
          return (
            <View style={[s.card, isOpen ? s.cardOpen : s.cardClosed]}>
              {/* Header row */}
              <View style={s.cardHead}>
                <View>
                  <Text style={s.ticker}>{t.ticker}</Text>
                  <Text style={s.account}>{t.account}</Text>
                </View>
                <View style={s.badges}>
                  <View style={[s.badge, isOpen ? s.badgeOpen : s.badgeClosed]}>
                    <Text style={[s.badgeText, { color: isOpen ? colors.accent2 : colors.muted }]}>{t.status}</Text>
                  </View>
                  <View style={[s.badge, t.direction === 'LONG' ? s.badgeLong : s.badgeShort]}>
                    <Text style={[s.badgeText, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>{t.direction}</Text>
                  </View>
                </View>
              </View>

              {/* Data rows */}
              <View style={s.dataRow}>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>ENTRY PRICE</Text>
                  <Text style={s.dataValue}>₹{fmtd(t.entry_price)}</Text>
                </View>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>QUANTITY</Text>
                  <Text style={s.dataValue}>{fmt(t.quantity)}</Text>
                </View>
                <View style={s.dataItem}>
                  <Text style={s.dataLabel}>INVESTED</Text>
                  <Text style={s.dataValue}>₹{fmt(t.invested_capital || 0)}</Text>
                </View>
              </View>

              {!isOpen && t.exit_price && (
                <View style={s.dataRow}>
                  <View style={s.dataItem}>
                    <Text style={s.dataLabel}>EXIT PRICE</Text>
                    <Text style={s.dataValue}>₹{fmtd(t.exit_price)}</Text>
                  </View>
                  <View style={s.dataItem}>
                    <Text style={s.dataLabel}>EXIT DATE</Text>
                    <Text style={s.dataValue}>{t.exit_date?.slice(0, 10) || '—'}</Text>
                  </View>
                </View>
              )}

              {/* Footer */}
              <View style={s.cardFoot}>
                <Text style={s.dateText}>{t.entry_date?.slice(0, 10)}</Text>
                {t.strategy && <Text style={s.strategy}>{t.strategy}</Text>}
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No trades found</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list:      { padding: spacing.lg, paddingBottom: 120 },

  toolbar: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  filters: { flexDirection: 'row', gap: spacing.sm },
  tab:     { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  tabActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:       { fontSize: font.size.sm, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.white },
  search: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: font.size.md, color: colors.text,
  },

  // Card
  card:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface },
  cardOpen:   { borderLeftWidth: 4, borderLeftColor: colors.accent },
  cardClosed: { borderLeftWidth: 4, borderLeftColor: colors.border2 },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  ticker:   { fontSize: font.size.h2, fontWeight: '800', color: colors.text },
  account:  { fontSize: font.size.sm, color: colors.muted, marginTop: 3 },
  badges:   { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', alignItems: 'flex-start' },
  badge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeOpen:   { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  badgeClosed: { backgroundColor: colors.surface2, borderColor: colors.border },
  badgeLong:   { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  badgeShort:  { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  badgeText:   { fontSize: font.size.xs, fontWeight: '700' },

  dataRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dataItem:  { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm },
  dataLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  dataValue: { fontSize: font.size.md, fontWeight: '700', color: colors.text },

  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  dateText: { fontSize: font.size.sm, color: colors.muted },
  strategy: { fontSize: font.size.sm, color: colors.accent, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },
})
