import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { getBankAccounts } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function BankScreen() {
  const [accounts,   setAccounts]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try { const data = await getBankAccounts(); setAccounts(Array.isArray(data) ? data : []) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <FlatList
      data={accounts}
      keyExtractor={a => a.id}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>TOTAL BALANCE</Text>
          <Text style={s.totalVal}>₹{fmtd(total)}</Text>
          <Text style={s.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
        </View>
      }
      renderItem={({ item: a }) => {
        const gain   = Number(a.balance) - Number(a.initial_balance)
        const isGain = gain >= 0
        const pct    = Number(a.initial_balance) > 0 ? (gain / Number(a.initial_balance) * 100) : 0
        return (
          <View style={[s.card, { borderLeftColor: isGain ? colors.bull : colors.bear }]}>
            <View style={s.cardHead}>
              <View>
                <Text style={s.bankName}>{a.bank_name}</Text>
                <Text style={s.holderName}>{a.holder_name}</Text>
              </View>
              <View style={s.right}>
                <Text style={s.balance}>₹{fmtd(a.balance)}</Text>
                <Text style={[s.gain, { color: isGain ? colors.bull : colors.bear }]}>
                  {isGain ? '+' : '−'}₹{fmtd(Math.abs(gain))} ({isGain ? '+' : ''}{pct.toFixed(2)}%)
                </Text>
              </View>
            </View>

            {/* Balance bar */}
            <View style={s.barBg}>
              <View style={[s.barFill, {
                backgroundColor: isGain ? colors.bull : colors.bear,
                width: `${Math.min(100, Math.max(5, (Number(a.balance) / Math.max(Number(a.initial_balance), Number(a.balance))) * 100))}%` as any,
              }]} />
            </View>

            <View style={s.cardFoot}>
              <Text style={s.footText}>Initial: ₹{fmtd(a.initial_balance)}</Text>
              <Text style={s.footText}>Current: ₹{fmtd(a.balance)}</Text>
            </View>
          </View>
        )
      }}
      ListEmptyComponent={
        <View style={s.center}>
          <Text style={s.emptyText}>No bank accounts</Text>
          <Text style={s.emptySub}>Add accounts from the web app</Text>
        </View>
      }
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  list:   { padding: spacing.lg, paddingBottom: 120 },

  totalCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.lg,
    borderTopWidth: 4, borderTopColor: colors.saffron,
  },
  totalLabel: { fontSize: font.size.sm, color: colors.muted, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.sm },
  totalVal:   { fontSize: font.size.h1, fontWeight: '800', color: colors.text, marginBottom: 4 },
  totalSub:   { fontSize: font.size.sm, color: colors.muted },

  card:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  bankName:   { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  holderName: { fontSize: font.size.sm, color: colors.muted, marginTop: 3 },
  right:      { alignItems: 'flex-end' },
  balance:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  gain:       { fontSize: font.size.sm, marginTop: 3 },

  barBg:   { height: 8, backgroundColor: colors.surface2, borderRadius: 4, marginBottom: spacing.md, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: font.size.sm, color: colors.muted },

  emptyText: { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },
  emptySub:  { fontSize: font.size.md, color: colors.muted, marginTop: spacing.sm },
})
