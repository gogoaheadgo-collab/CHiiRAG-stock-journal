import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { getSubscribers, getSubscriberTrades, getSettlements } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'
import { Redirect } from 'expo-router'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const BASE = process.env.EXPO_PUBLIC_API_URL || 'https://smk-stock-journal.vercel.app'

import { supabase } from '../../lib/supabase'

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${BASE}/api/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  return json
}

const createSettlement = (body: any) => apiFetch('settlements', { method: 'POST', body: JSON.stringify(body) })
const deleteSettlement = (id: string) => apiFetch('settlements', { method: 'DELETE', body: JSON.stringify({ id }) })

interface SubData {
  sub: any
  trades: any[]
  settlements: any[]
}

export default function RevenueScreen() {
  const { role, loading: authLoading } = useAuth()

  const [subDataList, setSubDataList] = useState<SubData[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [settModal,   setSettModal]   = useState(false)
  const [settSub,     setSettSub]     = useState<any | null>(null)
  const [settAmount,  setSettAmount]  = useState('')
  const [settNote,    setSettNote]    = useState('')
  const [saving,      setSaving]      = useState(false)

  if (!authLoading && role !== 'admin') return <Redirect href="/(app)/dashboard" />

  const load = useCallback(async () => {
    try {
      const subs = await getSubscribers()
      const list: SubData[] = await Promise.all(
        (Array.isArray(subs) ? subs : []).map(async (sub: any) => {
          const [trades, settlements] = await Promise.all([
            getSubscriberTrades(sub.user_id).catch(() => []),
            getSettlements(sub.user_id).catch(() => []),
          ])
          return {
            sub,
            trades:      Array.isArray(trades)      ? trades      : [],
            settlements: Array.isArray(settlements) ? settlements : [],
          }
        })
      )
      setSubDataList(list)
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const mtfTrades = (trades: any[]) => trades.filter(t => t.trade_type === 'MTF')

  const calcRevenue = (trades: any[]) => {
    const mtf = mtfTrades(trades).filter(t => t.status === 'CLOSED')
    let gross = 0, net = 0
    mtf.forEach(t => {
      const sign    = t.direction === 'LONG' ? 1 : -1
      const tradePnl = sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
      gross += tradePnl
      const investment  = Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity))
      const actualInv   = Number(t.actual_investment) || 0
      const adminRatio  = investment > 0 && actualInv > 0 ? (investment - actualInv) / investment : 1
      const mtfBase     = actualInv > 0 ? investment - actualInv : 0
      let mtfInt = 0
      if (mtfBase > 0 && t.mtf_interest_rate && t.entry_date && t.exit_date) {
        const days = Math.max(1, Math.floor((new Date(t.exit_date).getTime() - new Date(t.entry_date).getTime()) / 86400000))
        mtfInt = mtfBase * Number(t.mtf_interest_rate) * days / 36500
      }
      net += tradePnl * adminRatio - mtfInt
    })
    return { gross, net, count: mtf.length }
  }

  const totalSettled = (settlements: any[]) =>
    (settlements || []).filter(s => s.status === 'SETTLED').reduce((sum, s) => sum + Number(s.amount || 0), 0)

  const openSettleModal = (sd: SubData) => {
    setSettSub(sd)
    const { net } = calcRevenue(sd.trades)
    const settled = totalSettled(sd.settlements)
    setSettAmount(Math.max(0, net - settled).toFixed(2))
    setSettNote('')
    setSettModal(true)
  }

  const handleSettle = async () => {
    if (!settAmount || isNaN(Number(settAmount))) { Alert.alert('Error', 'Enter valid amount'); return }
    setSaving(true)
    try {
      await createSettlement({ subscriber_id: settSub.sub.user_id, amount: Number(settAmount), note: settNote.trim() || undefined })
      setSettModal(false)
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally { setSaving(false) }
  }

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        <Text style={s.pageTitle}>MTF Revenue Sharing</Text>
        <Text style={s.pageSub}>Based on closed MTF trades only</Text>

        {subDataList.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No subscribers</Text>
          </View>
        ) : (
          subDataList.map(sd => {
            const rev     = calcRevenue(sd.trades)
            const settled = totalSettled(sd.settlements)
            const pending = Math.max(0, rev.net - settled)
            const isExp   = expanded === sd.sub.user_id

            return (
              <View key={sd.sub.user_id} style={s.subBlock}>
                <TouchableOpacity
                  style={[s.subCard, pending > 0 && s.subCardPending]}
                  onPress={() => setExpanded(isExp ? null : sd.sub.user_id)}
                  activeOpacity={0.8}
                >
                  <View style={s.subHead}>
                    <View>
                      <Text style={s.subName}>{sd.sub.full_name || sd.sub.email}</Text>
                      <Text style={s.subEmail}>{sd.sub.email}</Text>
                    </View>
                    {pending > 0 && (
                      <View style={s.pendingBadge}>
                        <Text style={s.pendingText}>Due ₹{fmt0(pending)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.revRow}>
                    <View style={s.revStat}>
                      <Text style={s.revLabel}>MTF TRADES</Text>
                      <Text style={s.revVal}>{rev.count}</Text>
                    </View>
                    <View style={s.revStat}>
                      <Text style={s.revLabel}>GROSS P&L</Text>
                      <Text style={[s.revVal, { color: rev.gross >= 0 ? colors.green : colors.red }]}>
                        {rev.gross >= 0 ? '+' : '−'}₹{fmt0(Math.abs(rev.gross))}
                      </Text>
                    </View>
                    <View style={s.revStat}>
                      <Text style={s.revLabel}>YOUR SHARE</Text>
                      <Text style={[s.revVal, { color: colors.accent }]}>₹{fmt0(rev.net)}</Text>
                    </View>
                    <View style={s.revStat}>
                      <Text style={s.revLabel}>SETTLED</Text>
                      <Text style={[s.revVal, { color: colors.muted }]}>₹{fmt0(settled)}</Text>
                    </View>
                  </View>

                  {pending > 0 && (
                    <TouchableOpacity style={s.settleBtn} onPress={() => openSettleModal(sd)}>
                      <Text style={s.settleBtnText}>Record Settlement</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={s.expandHint}>{isExp ? '▲ Hide history' : '▼ Show history'}</Text>
                </TouchableOpacity>

                {/* Settlement history */}
                {isExp && (
                  <View style={s.settList}>
                    {sd.settlements.length === 0 ? (
                      <Text style={s.noSett}>No settlements recorded</Text>
                    ) : (
                      sd.settlements.map(st => (
                        <View key={st.id} style={s.settRow}>
                          <View>
                            <Text style={s.settDate}>{st.created_at?.slice(0, 10)}</Text>
                            {st.note ? <Text style={s.settNote}>{st.note}</Text> : null}
                          </View>
                          <View style={s.settRight}>
                            <Text style={s.settAmt}>₹{fmtd(st.amount)}</Text>
                            <TouchableOpacity onPress={() =>
                              Alert.alert('Delete Settlement', 'Remove this settlement?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSettlement(st.id); load() } },
                              ])
                            }>
                              <Text style={s.settDel}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Settlement Modal */}
      <Modal visible={settModal} transparent animationType="slide" onRequestClose={() => setSettModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Record Settlement</Text>
            {settSub && <Text style={s.modalSub}>{settSub.sub.full_name || settSub.sub.email}</Text>}

            <TextInput
              style={s.input}
              value={settAmount}
              onChangeText={setSettAmount}
              placeholder="Amount (₹)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              value={settNote}
              onChangeText={setSettNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.muted}
              multiline
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSettModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSettle} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Record'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list:      { padding: spacing.lg, paddingBottom: 120 },

  pageTitle: { fontSize: font.size.h2, fontWeight: '800', color: colors.text, marginBottom: 4 },
  pageSub:   { fontSize: font.size.sm, color: colors.muted, marginBottom: spacing.lg },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },

  subBlock: { marginBottom: spacing.sm },
  subCard:  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.border2 },
  subCardPending: { borderLeftColor: colors.gold },
  subHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  subName:  { fontSize: font.size.lg, fontWeight: '800', color: colors.text },
  subEmail: { fontSize: font.size.sm, color: colors.muted, marginTop: 2 },
  pendingBadge: { backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde68a', borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 4 },
  pendingText:  { fontSize: font.size.xs, color: '#92400e', fontWeight: '700' },

  revRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  revStat: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  revLabel:{ fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  revVal:  { fontSize: font.size.sm, fontWeight: '800', color: colors.text },

  settleBtn:     { backgroundColor: colors.gold, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  settleBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.sm },
  expandHint:    { fontSize: font.size.xs, color: colors.muted, textAlign: 'center' },

  settList: { backgroundColor: colors.surface2, borderRadius: radius.md, overflow: 'hidden', marginTop: 2 },
  noSett:   { padding: spacing.lg, color: colors.muted, textAlign: 'center' },
  settRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  settDate: { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  settNote: { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  settRight:{ alignItems: 'flex-end' },
  settAmt:  { fontSize: font.size.md, fontWeight: '800', color: colors.green },
  settDel:  { fontSize: font.size.xs, color: colors.red, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:  { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  modalTitle:{ fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  modalSub:  { fontSize: font.size.sm, color: colors.muted, marginTop: -spacing.sm },
  input:     {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text,
  },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
