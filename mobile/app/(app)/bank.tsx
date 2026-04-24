import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { getBankAccounts } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

type BankAccount = {
  id: string
  bank_name: string
  holder_name: string
  balance: number
  initial_balance: number
}

export default function BankScreen() {
  const [accounts,   setAccounts]   = useState<BankAccount[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getBankAccounts()
      setAccounts(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>

      {/* Total balance card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL BALANCE</Text>
        <Text style={styles.totalVal}>₹{fmt(totalBalance)}</Text>
        <Text style={styles.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />
        }
        renderItem={({ item: a }) => {
          const gain = a.balance - a.initial_balance
          const gainColor = gain >= 0 ? colors.green : colors.red
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.bankName}>{a.bank_name}</Text>
                  <Text style={styles.holderName}>{a.holder_name}</Text>
                </View>
                <View style={styles.balanceBlock}>
                  <Text style={styles.balance}>₹{fmt(a.balance)}</Text>
                  <Text style={[styles.gain, { color: gainColor }]}>
                    {gain >= 0 ? '+' : ''}₹{fmt(gain)}
                  </Text>
                </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  totalCard: {
    margin: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    padding: spacing.xl,
    alignItems: 'center',
  },
  totalLabel:  { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 3, marginBottom: spacing.sm },
  totalVal:    { fontFamily: font.mono, fontSize: font.size.h1, fontWeight: font.weight.black, color: colors.accent },
  totalSub:    { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankName:    { fontFamily: font.mono, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textPrimary },
  holderName:  { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  balanceBlock:{ alignItems: 'flex-end' },
  balance:     { fontFamily: font.mono, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textPrimary },
  gain:        { fontFamily: font.mono, fontSize: font.size.xs, marginTop: 2 },
  emptyText:   { fontFamily: font.mono, fontSize: font.size.md, color: colors.textMuted },
})
