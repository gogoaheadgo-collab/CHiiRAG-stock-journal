import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { getExecutions, createExecution, deleteExecution, updateTrade } from '../lib/api'
import { colors, font, spacing, radius } from '../lib/theme'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

interface Props {
  trade: any
  initialExecs?: any[]
  onUpdate?: () => void
  isReadOnly?: boolean
}

export default function ExecutionPanel({ trade, initialExecs, onUpdate, isReadOnly = false }: Props) {
  const [execs,    setExecs]    = useState<any[]>(initialExecs ?? [])
  const [loading,  setLoading]  = useState(!initialExecs)
  const [showForm, setShowForm] = useState(false)
  const [qty,      setQty]      = useState('')
  const [price,    setPrice]    = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const totalQty   = Number(trade.quantity) || 0
  const entryPrice = Number(trade.entry_price) || 0
  const mtfRate    = Number(trade.mtf_interest_rate) || 0
  const investment = Number(trade.invested_capital) || (entryPrice * totalQty)
  const actualInv  = Number(trade.actual_investment) || 0
  const mtfBase    = investment - actualInv

  const fetchExecs = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getExecutions(trade.id)
      setExecs(Array.isArray(d) ? d : [])
    } catch {}
    finally { setLoading(false) }
  }, [trade.id])

  useEffect(() => {
    if (!initialExecs) fetchExecs()
  }, [])

  const calcMTF = (exec: any) => {
    if (!mtfRate || mtfBase <= 0 || !trade.entry_date) return 0
    const days = Math.max(1, Math.floor(
      (new Date(exec.date).getTime() - new Date(trade.entry_date).getTime()) / 86400000
    ))
    return mtfBase * (Number(exec.quantity) / totalQty) * mtfRate * days / 36500
  }

  const soldQty     = execs.reduce((s, e) => s + Number(e.quantity), 0)
  const remainQty   = Math.max(0, totalQty - soldQty)
  const totalReal   = execs.reduce((s, e) => s + (Number(e.price) - entryPrice) * Number(e.quantity), 0)
  const totalMTFInt = execs.reduce((s, e) => s + calcMTF(e), 0)
  const remainMTF   = (mtfBase > 0 && mtfRate > 0 && trade.entry_date && remainQty > 0)
    ? mtfBase * (remainQty / totalQty) * mtfRate *
      Math.max(1, Math.floor((Date.now() - new Date(trade.entry_date).getTime()) / 86400000)) / 36500
    : 0

  const qtyNum     = parseFloat(qty) || 0
  const priceNum   = parseFloat(price) || 0
  const preview    = (qtyNum && priceNum) ? (priceNum - entryPrice) * qtyNum : null
  const mtfPreview = (qtyNum && priceNum && date && mtfBase > 0 && trade.entry_date)
    ? mtfBase * (qtyNum / totalQty) * mtfRate *
      Math.max(1, Math.floor((new Date(date).getTime() - new Date(trade.entry_date).getTime()) / 86400000)) / 36500
    : null

  const handleAdd = async () => {
    setError('')
    if (!qtyNum || !priceNum || !date) { setError('All fields required'); return }
    if (qtyNum > remainQty) { setError(`Max qty is ${fmt(remainQty)}`); return }
    setSaving(true)
    try {
      await createExecution({ trade_id: trade.id, type: 'SELL', quantity: qtyNum, price: priceNum, date })
      const newSold = soldQty + qtyNum
      if (newSold >= totalQty) {
        const newReal = totalReal + (priceNum - entryPrice) * qtyNum
        await updateTrade({ id: trade.id, exit_price: priceNum, exit_date: date, realized_gains: newReal, status: 'CLOSED' })
      }
      setQty(''); setPrice(''); setDate(new Date().toISOString().slice(0, 10))
      setShowForm(false)
      await fetchExecs()
      onUpdate?.()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Execution',
      'This will affect Realised P&L. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteExecution(id)
            await fetchExecs()
            onUpdate?.()
          } catch (e: any) { Alert.alert('Error', e.message) }
        }},
      ]
    )
  }

  if (loading) {
    return (
      <View style={s.wrap}>
        <ActivityIndicator color={colors.accent} size="small" style={{ padding: spacing.md }} />
      </View>
    )
  }

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>SELL EXECUTIONS</Text>
          <Text style={s.subtitle}>
            {'Entry ₹'}{fmtd(entryPrice)}{' · Qty '}{fmt(totalQty)}{' · Remaining '}
            <Text style={{ color: remainQty === 0 ? colors.red : colors.green, fontWeight: '700' }}>
              {fmt(remainQty)}
            </Text>
            {mtfRate > 0 ? <Text style={{ color: colors.gold }}>{' · MTF '}{mtfRate}{'%'}</Text> : null}
          </Text>
        </View>
        {!isReadOnly && remainQty > 0 && (
          <TouchableOpacity
            style={[s.addBtn, showForm && s.addBtnActive]}
            onPress={() => { setShowForm(v => !v); setError('') }}
          >
            <Text style={[s.addBtnText, showForm && { color: colors.muted }]}>
              {showForm ? 'Cancel' : '+ Sell'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sell Form */}
      {showForm && (
        <View style={s.form}>
          <View style={s.formRow}>
            <View style={s.field}>
              <Text style={s.fieldLabel}>QTY (max {fmt(remainQty)})</Text>
              <TextInput
                style={s.input}
                value={qty}
                onChangeText={setQty}
                placeholder={String(Math.floor(remainQty))}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>PRICE ₹</Text>
              <TextInput
                style={s.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>DATE</Text>
              <TextInput
                style={s.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
          {preview !== null && (
            <View style={s.preview}>
              <Text style={s.previewLabel}>
                {'P&L: '}
                <Text style={{ color: preview >= 0 ? colors.green : colors.red, fontWeight: '700' }}>
                  {preview >= 0 ? '+' : '−'}{'₹'}{fmtd(Math.abs(preview))}
                </Text>
              </Text>
              {mtfPreview != null && mtfPreview > 0 && (
                <Text style={s.previewLabel}>
                  {'  ·  MTF: '}
                  <Text style={{ color: colors.gold, fontWeight: '700' }}>{'₹'}{fmtd(mtfPreview)}</Text>
                </Text>
              )}
              {qtyNum >= remainQty && (
                <Text style={[s.previewLabel, { color: colors.red, fontWeight: '700' }]}>
                  {'  ·  Full exit — trade closes'}
                </Text>
              )}
            </View>
          )}
          {error ? <Text style={s.error}>{'⚠ '}{error}</Text> : null}
          <TouchableOpacity
            style={[s.sellBtn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
          >
            <Text style={s.sellBtnText}>{saving ? 'Saving…' : 'Confirm Sell'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Executions List */}
      {execs.length === 0 ? (
        <Text style={s.empty}>
          {isReadOnly ? 'No sell executions yet.' : 'No executions yet — tap + Sell to record a partial or full exit.'}
        </Text>
      ) : (
        <>
          {execs.map((e, i) => {
            const val      = Number(e.quantity) * Number(e.price)
            const realised = (Number(e.price) - entryPrice) * Number(e.quantity)
            const mtfInt   = calcMTF(e)
            return (
              <View key={e.id} style={[s.execRow, i % 2 !== 0 && s.execRowAlt]}>
                <View style={{ flex: 1 }}>
                  <View style={s.execTop}>
                    <Text style={s.execNum}>{'#'}{i + 1}</Text>
                    <Text style={s.execDate}>{e.date}</Text>
                    <Text style={s.execQty}>{fmt(e.quantity)} sh</Text>
                    <Text style={s.execMeta}>{'₹'}{fmtd(e.price)}</Text>
                  </View>
                  <View style={s.execBottom}>
                    <Text style={s.execMeta}>{'Val ₹'}{fmt(val)}</Text>
                    <Text style={[s.execPnl, { color: realised >= 0 ? colors.green : colors.red }]}>
                      {realised >= 0 ? '+' : '−'}{'₹'}{fmtd(Math.abs(realised))}
                    </Text>
                    {mtfInt > 0 && (
                      <Text style={[s.execMeta, { color: colors.gold }]}>{'MTF ₹'}{fmtd(mtfInt)}</Text>
                    )}
                  </View>
                </View>
                {!isReadOnly && (
                  <TouchableOpacity onPress={() => handleDelete(e.id)} hitSlop={8}>
                    <Text style={s.delBtn}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}

          {/* Summary */}
          <View style={s.summary}>
            <Text style={s.summaryItem}>
              {'Sold: '}
              <Text style={s.summaryVal}>{fmt(soldQty)} sh</Text>
            </Text>
            <Text style={s.summaryItem}>
              {'Realised: '}
              <Text style={[s.summaryVal, { color: totalReal >= 0 ? colors.green : colors.red }]}>
                {totalReal >= 0 ? '+' : '−'}{'₹'}{fmtd(Math.abs(totalReal))}
              </Text>
            </Text>
            {totalMTFInt > 0 && (
              <Text style={s.summaryItem}>
                {'MTF: '}
                <Text style={[s.summaryVal, { color: colors.gold }]}>{'₹'}{fmtd(totalMTFInt)}</Text>
              </Text>
            )}
            {remainMTF > 0 && (
              <Text style={s.summaryItem}>
                {'Rem MTF: '}
                <Text style={[s.summaryVal, { color: colors.gold }]}>{'₹'}{fmtd(remainMTF)}</Text>
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface2,
    borderTopWidth:  2,
    borderTopColor:  colors.accent,
    padding:         spacing.md,
    borderBottomLeftRadius:  radius.md,
    borderBottomRightRadius: radius.md,
  },

  header:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  title:    { fontSize: font.size.xs, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  subtitle: { fontSize: font.size.xs, color: colors.muted, marginTop: 2, lineHeight: 16 },

  addBtn:       { backgroundColor: colors.red, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.sm },
  addBtnActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  addBtnText:   { fontSize: font.size.xs, fontWeight: '700', color: colors.white },

  form:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  formRow:  { flexDirection: 'row', gap: spacing.xs },
  field:    { flex: 1 },
  fieldLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  input: {
    backgroundColor: colors.surface2,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
    fontSize:        font.size.sm,
    color:           colors.text,
  },
  preview:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  previewLabel:{ fontSize: font.size.xs, color: colors.muted },
  error:       { fontSize: font.size.xs, color: colors.red, marginTop: spacing.xs },
  sellBtn:     { backgroundColor: colors.red, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  sellBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.sm },

  empty: { fontSize: font.size.xs, color: colors.muted, paddingVertical: spacing.sm },

  execRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  execRowAlt: { backgroundColor: 'rgba(0,0,0,0.018)' },
  execTop:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  execBottom: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  execNum:    { fontSize: font.size.xs, color: colors.muted, minWidth: 18 },
  execDate:   { fontSize: font.size.xs, color: colors.muted },
  execQty:    { fontSize: font.size.xs, fontWeight: '700', color: colors.text },
  execMeta:   { fontSize: font.size.xs, color: colors.muted },
  execPnl:    { fontSize: font.size.xs, fontWeight: '700' },
  delBtn:     { fontSize: 20, color: colors.red, paddingHorizontal: 4, lineHeight: 22 },

  summary:     { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryItem: { fontSize: font.size.xs, color: colors.muted },
  summaryVal:  { fontWeight: '700', color: colors.text },
})
