import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { getPriceAlerts, deletePriceAlert } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

type PriceAlert = {
  id: string
  ticker: string
  status: 'ACTIVE' | 'TRIGGERED'
  above_tg1?: number
  above_tg2?: number
  below_tg1?: number
  below_tg2?: number
  valid_till: string
  triggered_targets: string[]
  note?: string
}

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<PriceAlert[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getPriceAlerts()
      setAlerts(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string, ticker: string) {
    Alert.alert('Delete Alert', `Remove alert for ${ticker}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deletePriceAlert(id)
            setAlerts(prev => prev.filter(a => a.id !== id))
          } catch (e: any) {
            Alert.alert('Error', e.message)
          }
        }
      }
    ])
  }

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function renderAlert({ item: a }: { item: PriceAlert }) {
    const isActive = a.status === 'ACTIVE'
    return (
      <View style={[styles.card, !isActive && styles.cardDim]}>
        <View style={styles.cardTop}>
          <Text style={styles.ticker}>{a.ticker}</Text>
          <View style={[styles.badge, { backgroundColor: isActive ? colors.accent + '22' : colors.textMuted + '22' }]}>
            <Text style={[styles.badgeText, { color: isActive ? colors.accent : colors.textMuted }]}>
              {a.status}
            </Text>
          </View>
        </View>

        <View style={styles.targets}>
          {a.above_tg1 && (
            <View style={styles.target}>
              <Text style={styles.targetLabel}>↑ TG1</Text>
              <Text style={[styles.targetVal, { color: colors.green }]}>₹{fmt(a.above_tg1)}</Text>
            </View>
          )}
          {a.above_tg2 && (
            <View style={styles.target}>
              <Text style={styles.targetLabel}>↑ TG2</Text>
              <Text style={[styles.targetVal, { color: colors.green }]}>₹{fmt(a.above_tg2)}</Text>
            </View>
          )}
          {a.below_tg1 && (
            <View style={styles.target}>
              <Text style={styles.targetLabel}>↓ TG1</Text>
              <Text style={[styles.targetVal, { color: colors.red }]}>₹{fmt(a.below_tg1)}</Text>
            </View>
          )}
          {a.below_tg2 && (
            <View style={styles.target}>
              <Text style={styles.targetLabel}>↓ TG2</Text>
              <Text style={[styles.targetVal, { color: colors.red }]}>₹{fmt(a.below_tg2)}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.validTill}>Valid till {a.valid_till}</Text>
          <TouchableOpacity onPress={() => handleDelete(a.id, a.ticker)}>
            <Text style={styles.deleteBtn}>DELETE</Text>
          </TouchableOpacity>
        </View>
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
      <FlatList
        data={alerts}
        keyExtractor={a => a.id}
        renderItem={renderAlert}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No alerts set</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardDim:    { opacity: 0.6 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  ticker:     { fontFamily: font.mono, fontSize: font.size.xl, fontWeight: font.weight.black, color: colors.textPrimary },
  badge:      { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText:  { fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.bold, letterSpacing: 1 },
  targets:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  target:     { backgroundColor: colors.bgInput, borderRadius: radius.sm, padding: spacing.sm, minWidth: 70 },
  targetLabel:{ fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 1 },
  targetVal:  { fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.bold },
  footer:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  validTill:  { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted },
  deleteBtn:  { fontFamily: font.mono, fontSize: font.size.xs, color: colors.red, letterSpacing: 1 },
  emptyText:  { fontFamily: font.mono, fontSize: font.size.md, color: colors.textMuted },
})
