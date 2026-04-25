import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { getPriceAlerts, deletePriceAlert } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getPriceAlerts()
      setAlerts(Array.isArray(data) ? data : [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string, ticker: string) {
    Alert.alert('Delete Alert', `Remove alert for ${ticker}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deletePriceAlert(id)
          setAlerts(prev => prev.filter(a => a.id !== id))
        }
      }
    ])
  }

  function renderAlert({ item: a }: { item: any }) {
    const isActive = a.status === 'ACTIVE'
    const triggeredKeys: string[] = a.triggered_targets || []

    const targets = [
      { key: 'above_tg1', label: '↑ TG1', isAbove: true,  value: a.above_tg1 },
      { key: 'above_tg2', label: '↑ TG2', isAbove: true,  value: a.above_tg2 },
      { key: 'below_tg1', label: '↓ TG1', isAbove: false, value: a.below_tg1 },
      { key: 'below_tg2', label: '↓ TG2', isAbove: false, value: a.below_tg2 },
    ].filter(t => t.value)

    return (
      <View style={[styles.card, !isActive && styles.cardDim]}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.ticker}>{a.ticker}</Text>
            <Text style={styles.validTill}>Valid till {a.valid_till}</Text>
          </View>
          <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusDone]}>
            <Text style={[styles.statusText, { color: isActive ? colors.accent2 : colors.muted }]}>{a.status}</Text>
          </View>
        </View>

        <View style={styles.targets}>
          {targets.map(t => {
            const hit = triggeredKeys.includes(t.key)
            return (
              <View key={t.key} style={[styles.target, hit && styles.targetHit]}>
                <Text style={[styles.targetLabel, { color: t.isAbove ? colors.bull : colors.bear }]}>{t.label}</Text>
                <Text style={[styles.targetVal, hit && styles.targetValHit]}>Rs.{fmtd(t.value)}</Text>
                {hit && <Text style={styles.hitMark}>✓</Text>}
              </View>
            )
          })}
        </View>

        {a.note && <Text style={styles.note}>📝 {a.note}</Text>}

        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(a.id, a.ticker)}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <FlatList
      data={alerts}
      keyExtractor={a => a.id}
      renderItem={renderAlert}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, backgroundColor: colors.bg }}
      style={{ backgroundColor: colors.bg }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No alerts set</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  cardDim: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  ticker:    { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.xl, color: colors.text },
  validTill: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },

  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  statusActive: { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  statusDone:   { backgroundColor: colors.surface2,  borderColor: colors.border },
  statusText:   { fontFamily: 'DMmono', fontSize: font.size.xs, fontWeight: '700', letterSpacing: 0.5 },

  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  target: {
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, minWidth: 70, alignItems: 'center',
  },
  targetHit:    { borderColor: colors.accent, backgroundColor: colors.accentDim },
  targetLabel:  { fontFamily: 'DMmono', fontSize: font.size.xs, fontWeight: '700', marginBottom: 2 },
  targetVal:    { fontFamily: 'DMmono', fontSize: font.size.sm, color: colors.text },
  targetValHit: { color: colors.accent2 },
  hitMark:      { fontSize: 10, color: colors.accent, marginTop: 2 },

  note: { fontFamily: 'LibreBaskerville', fontSize: font.size.sm, color: colors.muted, marginBottom: spacing.sm },

  deleteBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 4,
  },
  deleteBtnText: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted },

  emptyText: { fontFamily: 'LibreBaskerville', fontSize: font.size.xxl, color: colors.border2 },
})
