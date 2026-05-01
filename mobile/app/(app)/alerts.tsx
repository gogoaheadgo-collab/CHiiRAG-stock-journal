import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native'
import { getPriceAlerts, createPriceAlert, deletePriceAlert, searchTicker } from '../../lib/api'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const VALIDITY_OPTIONS = [
  { label: '1 Month',  value: '1M' },
  { label: '3 Months', value: '3M' },
]

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [addModal,   setAddModal]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Form state
  const [ticker,    setTicker]   = useState('')
  const [tickerRes, setTickerRes] = useState<any[]>([])
  const [aboveTg1,  setAboveTg1] = useState('')
  const [aboveTg2,  setAboveTg2] = useState('')
  const [belowTg1,  setBelowTg1] = useState('')
  const [belowTg2,  setBelowTg2] = useState('')
  const [validity,  setValidity] = useState('1M')
  const [note,      setNote]     = useState('')

  const load = useCallback(async () => {
    try { const data = await getPriceAlerts(); setAlerts(Array.isArray(data) ? data : []) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTickerSearch = async (q: string) => {
    setTicker(q)
    if (q.length < 2) { setTickerRes([]); return }
    try { const res = await searchTicker(q); setTickerRes(Array.isArray(res) ? res.slice(0, 5) : []) }
    catch { setTickerRes([]) }
  }

  const handleCreate = async () => {
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker symbol'); return }
    if (!aboveTg1 && !belowTg1) { Alert.alert('Error', 'Set at least one target'); return }
    setSaving(true)
    try {
      await createPriceAlert({
        ticker:   ticker.trim().toUpperCase(),
        above_tg1: aboveTg1 ? Number(aboveTg1) : undefined,
        above_tg2: aboveTg2 ? Number(aboveTg2) : undefined,
        below_tg1: belowTg1 ? Number(belowTg1) : undefined,
        below_tg2: belowTg2 ? Number(belowTg2) : undefined,
        validity,
        note: note.trim() || undefined,
      })
      setAddModal(false)
      resetForm()
      load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally { setSaving(false) }
  }

  const resetForm = () => {
    setTicker(''); setTickerRes([])
    setAboveTg1(''); setAboveTg2('')
    setBelowTg1(''); setBelowTg2('')
    setValidity('1M'); setNote('')
  }

  const handleDelete = (id: string, ticker: string) =>
    Alert.alert('Delete Alert', `Remove alert for ${ticker}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deletePriceAlert(id)
        setAlerts(p => p.filter(a => a.id !== id))
      }},
    ])

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      {/* Add button header */}
      <View style={s.header}>
        <Text style={s.headerCount}>{alerts.filter(a => a.status === 'ACTIVE').length} active alert{alerts.filter(a => a.status === 'ACTIVE').length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)}>
          <Text style={s.addBtnText}>+ New Alert</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={a => a.id}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        renderItem={({ item: a }) => {
          const isActive  = a.status === 'ACTIVE'
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
            <Text style={s.emptySub}>Tap "+ New Alert" to create one</Text>
          </View>
        }
      />

      {/* Create Alert Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => { setAddModal(false); resetForm() }}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>New Price Alert</Text>

              {/* Ticker search */}
              <Text style={s.fieldLabel}>TICKER</Text>
              <TextInput
                style={s.input}
                value={ticker}
                onChangeText={handleTickerSearch}
                placeholder="e.g. RELIANCE"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />
              {tickerRes.length > 0 && (
                <View style={s.suggest}>
                  {tickerRes.map((r: any) => (
                    <TouchableOpacity
                      key={r.symbol}
                      style={s.suggestRow}
                      onPress={() => { setTicker(r.symbol); setTickerRes([]) }}
                    >
                      <Text style={s.suggestSym}>{r.symbol}</Text>
                      <Text style={s.suggestName}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Above targets */}
              <Text style={s.fieldLabel}>ABOVE TARGETS</Text>
              <View style={s.twoCol}>
                <TextInput style={[s.input, s.halfInput]} value={aboveTg1} onChangeText={setAboveTg1} placeholder="Target 1 ₹" placeholderTextColor={colors.muted} keyboardType="numeric" />
                <TextInput style={[s.input, s.halfInput]} value={aboveTg2} onChangeText={setAboveTg2} placeholder="Target 2 ₹" placeholderTextColor={colors.muted} keyboardType="numeric" />
              </View>

              {/* Below targets */}
              <Text style={s.fieldLabel}>BELOW TARGETS</Text>
              <View style={s.twoCol}>
                <TextInput style={[s.input, s.halfInput]} value={belowTg1} onChangeText={setBelowTg1} placeholder="Target 1 ₹" placeholderTextColor={colors.muted} keyboardType="numeric" />
                <TextInput style={[s.input, s.halfInput]} value={belowTg2} onChangeText={setBelowTg2} placeholder="Target 2 ₹" placeholderTextColor={colors.muted} keyboardType="numeric" />
              </View>

              {/* Validity */}
              <Text style={s.fieldLabel}>VALIDITY</Text>
              <View style={s.validRow}>
                {VALIDITY_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.value}
                    style={[s.validBtn, validity === o.value && s.validBtnActive]}
                    onPress={() => setValidity(o.value)}
                  >
                    <Text style={[s.validBtnText, validity === o.value && s.validBtnTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Note */}
              <Text style={s.fieldLabel}>NOTE (optional)</Text>
              <TextInput
                style={[s.input, { minHeight: 60 }]}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note…"
                placeholderTextColor={colors.muted}
                multiline
              />

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddModal(false); resetForm() }}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                  <Text style={s.saveText}>{saving ? 'Saving…' : 'Create Alert'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  list:      { padding: spacing.lg, paddingBottom: 120 },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCount:  { fontSize: font.size.md, color: colors.muted, fontWeight: '600' },
  addBtn:       { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  addBtnText:   { color: colors.white, fontSize: font.size.sm, fontWeight: '700' },

  card:      { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  dimmed:    { opacity: 0.55 },
  cardHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  ticker:    { fontSize: font.size.h2, fontWeight: '800', color: colors.text },
  validTill: { fontSize: font.size.sm, color: colors.muted, marginBottom: spacing.md },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '90%', paddingBottom: 40 },
  modalTitle: { fontSize: font.size.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  fieldLabel: { fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text, marginBottom: spacing.sm,
  },
  twoCol:   { flexDirection: 'row', gap: spacing.sm },
  halfInput:{ flex: 1 },
  suggest:  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm },
  suggestRow: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestSym:  { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  suggestName: { fontSize: font.size.xs, color: colors.muted },
  validRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  validBtn:    { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.sm, alignItems: 'center' },
  validBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  validBtnText:   { fontSize: font.size.sm, fontWeight: '700', color: colors.muted },
  validBtnTextActive: { color: colors.white },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
