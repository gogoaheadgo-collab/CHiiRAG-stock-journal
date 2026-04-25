import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Alert, TouchableOpacity } from 'react-native'
import { getPriceAlerts, deletePriceAlert } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try { const data = await getPriceAlerts(); setAlerts(Array.isArray(data) ? data : []) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string, ticker: string) =>
    Alert.alert('Delete Alert', `Remove alert for ${ticker}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePriceAlert(id); setAlerts(p => p.filter(a => a.id !== id)) } }
    ])

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <FlatList
      data={alerts}
      keyExtractor={a => a.id}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
      renderItem={({ item: a }) => {
        const isActive = a.status === 'ACTIVE'
        const triggered: string[] = a.triggered_targets || []
        const targets = [
          { key: 'above_tg1', label: '↑ Target 1', isAbove: true,  val: a.above_tg1 },
          { key: 'above_tg2', label: '↑ Target 2', isAbove: true,  val: a.above_tg2 },
          { key: 'below_tg1', label: '↓ Target 1', isAbove: false, val: a.below_tg1 },
          { key: 'below_tg2', label: '↓ Target 2', isAbove: false, val: a.below_tg2 },
        ].filter(t => t.val)

        return (
          <View style={[s.card, !isActive && s.dimmed]}>
            <View style={s.cardHead}>
              <Text style={s.ticker}>{a.ticker}</Text>
              <View style={[s.statusBadge, isActive ? s.activeBadge : s.doneBadge]}>
                <Text style={[s.statusText, { color: isActive ? colors.accent2 : colors.muted }]}>{a.status}</Text>
              </View>
            </View>
            <Text style={s.validTill}>Valid till {a.valid_till}</Text>

            <View style={s.targets}>
              {targets.map(t => {
                const hit = triggered.includes(t.key)
                return (
                  <View key={t.key} style={[s.targetRow, hit && s.targetHit]}>
                    <Text style={[s.targetLabel, { color: t.isAbove ? colors.bull : colors.bear }]}>{t.label}</Text>
                    <Text style={[s.targetVal, hit && { color: colors.accent }]}>₹{fmtd(t.val)}</Text>
                    {hit && <Text style={s.hitCheck}>✓ HIT</Text>}
                  </View>
                )
              })}
            </View>

            {a.note && <Text style={s.note}>📝 {a.note}</Text>}

            <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(a.id, a.ticker)}>
              <Text style={s.delBtnText}>Delete Alert</Text>
            </TouchableOpacity>
          </View>
        )
      }}
      ListEmptyComponent={
        <View style={s.center}>
          <Text style={s.emptyText}>No alerts set</Text>
          <Text style={s.emptySub}>Add alerts from the web app</Text>
        </View>
      }
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  list:   { padding: spacing.lg, paddingBottom: 120 },

  card:   { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  dimmed: { opacity: 0.55 },

  cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticker:      { fontSize: font.size.h2, fontWeight: '800', color: colors.text },
  validTill:   { fontSize: font.size.sm, color: colors.muted, marginBottom: spacing.md },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  activeBadge: { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  doneBadge:   { backgroundColor: colors.surface2, borderColor: colors.border },
  statusText:  { fontSize: font.size.sm, fontWeight: '700' },

  targets:    { gap: spacing.sm, marginBottom: spacing.md },
  targetRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, gap: spacing.md },
  targetHit:  { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: '#bae6fd' },
  targetLabel:{ fontSize: font.size.md, fontWeight: '700', flex: 1 },
  targetVal:  { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  hitCheck:   { fontSize: font.size.sm, color: colors.accent, fontWeight: '700' },

  note:       { fontSize: font.size.sm, color: colors.muted, marginBottom: spacing.md },
  delBtn:     { alignSelf: 'flex-end', borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  delBtnText: { fontSize: font.size.sm, color: colors.muted, fontWeight: '600' },

  emptyText:  { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },
  emptySub:   { fontSize: font.size.md, color: colors.muted, marginTop: spacing.sm },
})
