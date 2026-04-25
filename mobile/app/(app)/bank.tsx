import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { getBankAccounts } from '../../lib/api'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function BankScreen() {
  const [accounts,   setAccounts]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getBankAccounts()
      setAccounts(Array.isArray(data) ? data : [])
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <FlatList
      data={accounts}
      keyExtractor={a => a.id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL BALANCE</Text>
          <Text style={styles.totalVal}>Rs.{fmtd(totalBalance)}</Text>
          <Text style={styles.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
        </View>
      }
      renderItem={({ item: a }) => {
        const gain = Number(a.balance) - Number(a.initial_balance)
        const isGain = gain >= 0
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.bankName}>{a.bank_name}</Text>
                <Text style={styles.holderName}>{a.holder_name}</Text>
              </View>
              <View style={styles.rightBlock}>
                <Text style={styles.balance}>Rs.{fmtd(a.balance)}</Text>
                <Text style={[styles.gain, { color: isGain ? colors.bull : colors.bear }]}>
                  {isGain ? '+' : '−'}Rs.{fmt(Math.abs(gain))}
                </Text>
              </View>
            </View>
            {/* Balance bar */}
            <View style={styles.barContainer}>
              <View style={[styles.bar, { backgroundColor: isGain ? colors.accentDim : '#fee2e2', flex: 1 }]}>
                <View style={[styles.barFill, {
                  backgroundColor: isGain ? colors.bull : colors.bear,
                  width: `${Math.min(100, (Number(a.balance) / Math.max(Number(a.initial_balance), Number(a.balance))) * 100)}%`,
                }]} />
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>INITIAL: Rs.{fmtd(a.initial_balance)}</Text>
              <Text style={styles.footerLabel}>CURRENT: Rs.{fmtd(a.balance)}</Text>
            </View>
          </View>
        )
      }}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No bank accounts added</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  totalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.lg,
    ...shadow.sm,
  },
  totalLabel: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, letterSpacing: 2, marginBottom: spacing.sm },
  totalVal:   { fontFamily: 'LibreBaskervilleBold', fontSize: 28, fontWeight: '700', color: colors.text },
  totalSub:   { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: spacing.xs },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  bankName:   { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.xl, color: colors.text },
  holderName: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  rightBlock: { alignItems: 'flex-end' },
  balance:    { fontFamily: 'DMmono', fontSize: font.size.lg, fontWeight: '700', color: colors.text },
  gain:       { fontFamily: 'DMmono', fontSize: font.size.xs, marginTop: 2 },

  barContainer: { marginVertical: spacing.sm },
  bar:          { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel:{ fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted },

  emptyText:  { fontFamily: 'LibreBaskerville', fontSize: font.size.xxl, color: colors.border2 },
})
