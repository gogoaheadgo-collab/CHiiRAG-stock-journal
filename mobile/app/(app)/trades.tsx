import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native'
import {
  getTrades, getExecutions, getStockPrice, getAdminMirror,
  getSubscriberTrades, getSharedAccountTrades,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'
import ExecutionPanel from '../../components/ExecutionPanel'
import { getCurrentQty, getRealisedPnl } from '../../lib/calculations'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

type Filter = 'ALL' | 'OPEN' | 'CLOSED'
type Source = 'own' | 'mirrored' | 'shared'

interface TradeItem {
  trade: any
  execs: any[]
  source: Source
}

function calcMTFForTrade(t: any): number {
  if (!t.mtf_interest_rate || !t.entry_date) return 0
  const totalVal = Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity))
  if (!totalVal) return 0
  const margin = Number(t.actual_investment) || 0
  const base = margin > 0 ? totalVal - margin : totalVal
  if (base <= 0) return 0
  const end = t.status === 'CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
  const entry = new Date(t.entry_date)
  const days = Math.max(1, Math.floor((end.getTime() - entry.getTime()) / 86400000))
  return (base * Number(t.mtf_interest_rate) * days) / 36500
}

function DataCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.dataItem}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={[s.dataValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}

export default function TradesScreen() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [items,      setItems]      = useState<TradeItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter,     setFilter]     = useState<Filter>('ALL')
  const [search,     setSearch]     = useState('')
  const [livePrices,     setLivePrices]     = useState<Record<string, number>>({})
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [expandedExecId,     setExpandedExecId]      = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const tradesRaw = await getTrades()
      const ownTrades: any[] = Array.isArray(tradesRaw) ? tradesRaw : []

      const ownItems: TradeItem[] = await Promise.all(
        ownTrades.map(async t => {
          const exs = await getExecutions(t.id).catch(() => [])
          return { trade: t, execs: Array.isArray(exs) ? exs : [], source: 'own' as Source }
        })
      )

      let allItems: TradeItem[] = [...ownItems]

      if (isAdmin) {
        const mirror = await getAdminMirror().catch(() => [])
        const accounts: any[] = Array.isArray(mirror) ? mirror : []
        const nested = await Promise.all(
          accounts.map(async (m: any) => {
            try {
              const d = await getSubscriberTrades(m.subscriber_id)
              const trades: any[] = Array.isArray(d?.trades) ? d.trades : []
              const execsList: any[] = Array.isArray(d?.executions) ? d.executions : []
              return trades.map(t => ({
                trade: t,
                execs: execsList.filter((e: any) => e.trade_id === t.id),
                source: 'mirrored' as Source,
              }))
            } catch { return [] }
          })
        )
        allItems = [...allItems, ...nested.flat()]
      } else {
        const shared = await getSharedAccountTrades().catch(() => ({ trades: [], executions: [] }))
        const sharedTrades: any[] = Array.isArray(shared?.trades) ? shared.trades : []
        const sharedExecs: any[] = Array.isArray(shared?.executions) ? shared.executions : []
        const sharedItems: TradeItem[] = sharedTrades.map(t => ({
          trade: t,
          execs: sharedExecs.filter((e: any) => e.trade_id === t.id),
          source: 'shared' as Source,
        }))
        allItems = [...allItems, ...sharedItems]
      }

      setItems(allItems)

      // Fetch live prices for open trades
      const openTickers = [...new Set(allItems.filter(i => i.trade.status === 'OPEN').map(i => i.trade.ticker as string))]
      openTickers.forEach(async ticker => {
        try {
          const d = await getStockPrice(ticker)
          if (d?.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price }))
        } catch {}
      })
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const filtered = items
    .filter(i => filter === 'ALL' || i.trade.status === filter)
    .filter(i => !search ||
      (i.trade.ticker || '').toUpperCase().includes(search.toUpperCase()) ||
      (i.trade.account || '').toUpperCase().includes(search.toUpperCase())
    )

  const tickerSummary = useMemo(() => {
    type TG = { ticker: string; rows: TradeItem[]; open: number; closed: number; invested: number; unrealised: number; realised: number; hasLive: boolean; currQty: number }
    const map: Record<string, TG> = {}
    items
      .filter(i => filter === 'ALL' || i.trade.status === filter)
      .filter(i => !search || (i.trade.ticker || '').toUpperCase().includes(search.toUpperCase()))
      .forEach(i => {
        const ticker = i.trade.ticker
        if (!map[ticker]) map[ticker] = { ticker, rows: [], open: 0, closed: 0, invested: 0, unrealised: 0, realised: 0, hasLive: false, currQty: 0 }
        map[ticker].rows.push(i)
        if (i.trade.status === 'OPEN') {
          map[ticker].open++
          map[ticker].invested += Number(i.trade.invested_capital || 0)
          const cq = getCurrentQty(i.trade, i.execs)
          map[ticker].currQty += cq
          const cmp = livePrices[ticker]
          if (cmp) {
            const sign = i.trade.direction === 'LONG' ? 1 : -1
            map[ticker].unrealised += sign * (cmp - Number(i.trade.entry_price)) * cq
            map[ticker].hasLive = true
          }
          map[ticker].realised += getRealisedPnl(i.trade, i.execs)
        } else {
          map[ticker].closed++
          map[ticker].realised += getRealisedPnl(i.trade, i.execs)
        }
      })
    return Object.values(map).sort((a, b) => b.open - a.open || a.ticker.localeCompare(b.ticker))
  }, [items, filter, search, livePrices])

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
        keyExtractor={i => i.trade.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={s.summarySection}>
            <View style={s.summaryHead}>
              <Text style={s.summaryTitle}>TICKER SUMMARY</Text>
            </View>
            {tickerSummary.length === 0 ? (
              <Text style={s.summaryEmpty}>No tickers</Text>
            ) : (
              tickerSummary.map(tg => {
                const isExp  = expandedTicker === tg.ticker
                const expRows = isExp
                  ? tg.rows.filter(r => filter === 'ALL' || r.trade.status === filter)
                  : []
                return (
                  <View key={tg.ticker}>
                    <TouchableOpacity
                      style={[s.tickerRow, isExp && s.tickerRowActive]}
                      onPress={() => setExpandedTicker(isExp ? null : tg.ticker)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.tickerName}>{tg.ticker}</Text>
                        <Text style={s.tickerMeta}>
                          {tg.open > 0 ? `${tg.open} Open` : ''}{tg.open > 0 && tg.closed > 0 ? '  ·  ' : ''}{tg.closed > 0 ? `${tg.closed} Closed` : ''}
                        </Text>
                        {tg.currQty > 0 && (
                          <Text style={s.tickerMeta}>Curr Qty: {fmt(tg.currQty)}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {tg.invested > 0 && <Text style={s.tickerInv}>Inv ₹{fmtd(tg.invested)}</Text>}
                        {tg.hasLive && (
                          <Text style={[s.tickerPnl, { color: tg.unrealised >= 0 ? colors.green : colors.red }]}>
                            {tg.unrealised >= 0 ? '+' : '−'}₹{fmt(Math.abs(tg.unrealised))} U
                          </Text>
                        )}
                        {tg.closed > 0 && tg.realised !== 0 && (
                          <Text style={[s.tickerPnl, { color: tg.realised >= 0 ? colors.green : colors.red }]}>
                            {tg.realised >= 0 ? '+' : '−'}₹{fmt(Math.abs(tg.realised))} R
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {isExp && expRows.map(item => {
                      const t      = item.trade
                      const isOpen = t.status === 'OPEN'
                      const cmp    = livePrices[t.ticker]
                      const uPnl   = (cmp && isOpen)
                        ? (t.direction === 'LONG' ? 1 : -1) * (cmp - Number(t.entry_price)) * getCurrentQty(t, item.execs)
                        : null
                      const rPnl   = getRealisedPnl(t, item.execs) || null
                      return (
                        <View key={t.id} style={[s.subRow, isOpen ? s.subRowOpen : s.subRowClosed]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: 2 }}>
                              <Text style={s.subAcct}>{t.account}</Text>
                              <View style={[s.badge, t.direction === 'LONG' ? s.badgeLong : s.badgeShort]}>
                                <Text style={[s.badgeText, { color: t.direction === 'LONG' ? colors.green : colors.red }]}>{t.direction}</Text>
                              </View>
                            </View>
                            <Text style={s.subMeta}>{t.entry_date?.slice(0, 10)}  ·  Entry ₹{fmtd(t.entry_price)}  ·  Qty {fmt(getCurrentQty(t, item.execs))}</Text>
                            {isOpen && cmp ? <Text style={s.subMeta}>CMP ₹{fmtd(cmp)}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {uPnl !== null && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 9, color: colors.muted }}>U</Text>
                                <Text style={[s.subPnl, { color: uPnl >= 0 ? colors.green : colors.red }]}>
                                  {uPnl >= 0 ? '+' : '−'}₹{fmt(Math.abs(uPnl))}
                                </Text>
                              </View>
                            )}
                            {rPnl !== null && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 9, color: colors.muted }}>R</Text>
                                <Text style={[s.subPnl, { color: rPnl >= 0 ? colors.green : colors.red }]}>
                                  {rPnl >= 0 ? '+' : '−'}₹{fmt(Math.abs(rPnl))}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )
              })
            )}
            <View style={s.summarySep} />
          </View>
        }
        renderItem={({ item }) => {
          const t       = item.trade
          const execs   = item.execs
          const isOpen  = t.status === 'OPEN'
          const cmp     = livePrices[t.ticker]
          const showExec = expandedExecId === t.id

          const soldQty    = execs.reduce((s: number, e: any) => s + Number(e.quantity), 0)
          const currentQty = Math.max(0, Number(t.quantity) - soldQty)
          const realisedPnL = execs.reduce((s: number, e: any) =>
            s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
          const unrealisedPnL = (cmp && currentQty > 0)
            ? (t.direction === 'SHORT'
                ? (Number(t.entry_price) - cmp) * currentQty
                : (cmp - Number(t.entry_price)) * currentQty)
            : null
          const mtfInt = calcMTFForTrade(t)

          return (
            <View style={s.cardWrap}>
              <View style={[s.card, isOpen ? s.cardOpen : s.cardClosed]}>
                {/* Header */}
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
                    {item.source === 'mirrored' && (
                      <View style={s.badgeMirrored}>
                        <Text style={[s.badgeText, { color: colors.gold }]}>MIRRORED</Text>
                      </View>
                    )}
                    {item.source === 'shared' && (
                      <View style={s.badgeShared}>
                        <Text style={[s.badgeText, { color: colors.accent }]}>SHARED</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Row 1: Entry Date, Entry ₹, Qty, Curr Qty */}
                <View style={s.dataRow}>
                  <DataCell label="ENTRY DATE" value={t.entry_date?.slice(0, 10) || '—'} />
                  <DataCell label="ENTRY ₹"   value={`₹${fmtd(t.entry_price)}`} />
                  <DataCell label="QTY"        value={fmt(t.quantity)} />
                  <DataCell
                    label="CURR QTY"
                    value={fmt(currentQty)}
                    color={currentQty < Number(t.quantity) ? colors.gold : undefined}
                  />
                </View>

                {/* Row 2: CMP, Exit ₹, Unrealised, Realised */}
                <View style={s.dataRow}>
                  <DataCell
                    label="CMP"
                    value={cmp ? `₹${fmtd(cmp)}` : '—'}
                    color={cmp ? colors.text : colors.muted}
                  />
                  <DataCell label="EXIT ₹" value={t.exit_price ? `₹${fmtd(t.exit_price)}` : '—'} />
                  <DataCell
                    label="UNREALISED"
                    value={unrealisedPnL != null
                      ? `${unrealisedPnL >= 0 ? '+' : '−'}₹${fmt(Math.abs(unrealisedPnL))}`
                      : '—'}
                    color={unrealisedPnL != null
                      ? (unrealisedPnL >= 0 ? colors.green : colors.red)
                      : colors.muted}
                  />
                  <DataCell
                    label="REALISED"
                    value={execs.length > 0
                      ? `${realisedPnL >= 0 ? '+' : '−'}₹${fmt(Math.abs(realisedPnL))}`
                      : '—'}
                    color={execs.length > 0
                      ? (realisedPnL >= 0 ? colors.green : colors.red)
                      : colors.muted}
                  />
                </View>

                {/* Row 3: MTF Interest + Strategy (conditional) */}
                {(mtfInt > 0 || t.strategy) && (
                  <View style={s.dataRow}>
                    {mtfInt > 0 && (
                      <DataCell label="MTF INT" value={`₹${fmtd(mtfInt)}`} color={colors.gold} />
                    )}
                    {t.strategy && (
                      <DataCell label="STRATEGY" value={t.strategy} />
                    )}
                  </View>
                )}

                {/* Footer: date + exec toggle */}
                <View style={s.cardFoot}>
                  <Text style={s.dateText}>{t.entry_date?.slice(0, 10)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <TouchableOpacity onPress={() => setExpandedExecId(showExec ? null : t.id)}>
                      <Text style={s.execToggle}>
                        {showExec ? '▲ Hide Executions' : `▼ Executions${execs.length > 0 ? ` (${execs.length})` : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {showExec && (
                <ExecutionPanel
                  trade={t}
                  initialExecs={execs}
                  onUpdate={load}
                  isReadOnly={item.source !== 'own'}
                />
              )}
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
  tab:         { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  tabActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText:     { fontSize: font.size.sm, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.white },
  search: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: font.size.md, color: colors.text,
  },

  cardWrap:   { marginBottom: spacing.md },
  card:       { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.surface },
  cardOpen:   { borderLeftWidth: 4, borderLeftColor: colors.accent },
  cardClosed: { borderLeftWidth: 4, borderLeftColor: colors.border2 },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  ticker:   { fontSize: font.size.h2, fontWeight: '800', color: colors.text },
  account:  { fontSize: font.size.sm, color: colors.muted, marginTop: 3 },
  badges:   { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', alignItems: 'flex-start' },
  badge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  badgeOpen:     { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  badgeClosed:   { backgroundColor: colors.surface2, borderColor: colors.border },
  badgeLong:     { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  badgeShort:    { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  badgeMirrored: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  badgeShared:   { backgroundColor: colors.accentDim, borderColor: '#bae6fd', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  badgeText:     { fontSize: font.size.xs, fontWeight: '700' },

  dataRow:   { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  dataItem:  { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm },
  dataLabel: { fontSize: 9, color: colors.muted, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  dataValue: { fontSize: font.size.sm, fontWeight: '700', color: colors.text },

  cardFoot:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  dateText:   { fontSize: font.size.xs, color: colors.muted },
  typeBadge:  { backgroundColor: '#ede9fe', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  typeText:   { fontSize: font.size.xs, color: '#7c3aed', fontWeight: '700' },
  execToggle: { fontSize: font.size.xs, color: colors.accent, fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: font.size.xl, color: colors.border2, fontWeight: '700' },

  summarySection:       { marginBottom: spacing.xs },
  summaryHead:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  summaryTitle:         { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  summaryFilters:       { flexDirection: 'row', gap: 3, backgroundColor: colors.surface, borderRadius: 8, padding: 3, borderWidth: 1, borderColor: colors.border },
  summaryTab:           { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
  summaryTabActive:     { backgroundColor: colors.accent },
  summaryTabText:       { fontSize: font.size.xs, fontWeight: '600', color: colors.muted },
  summaryTabTextActive: { color: colors.white },
  summaryEmpty:         { fontSize: font.size.sm, color: colors.muted, paddingVertical: spacing.sm },
  summarySep:           { height: 1, backgroundColor: colors.border, marginTop: spacing.md, marginBottom: spacing.md },

  tickerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  tickerRowActive: { borderColor: colors.accent },
  tickerName:      { fontSize: font.size.md, fontWeight: '800', color: colors.text },
  tickerMeta:      { fontSize: font.size.xs, color: colors.muted, marginTop: 1 },
  tickerInv:       { fontSize: font.size.xs, color: colors.muted },
  tickerPnl:       { fontSize: font.size.sm, fontWeight: '700' },

  subRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface2, borderLeftWidth: 3, borderLeftColor: colors.border, marginBottom: 2, borderRadius: radius.sm },
  subRowOpen:   { borderLeftColor: colors.accent },
  subRowClosed: { borderLeftColor: colors.border2 },
  subAcct:      { fontSize: font.size.sm, fontWeight: '700', color: colors.text },
  subMeta:      { fontSize: font.size.xs, color: colors.muted, marginTop: 1 },
  subPnl:       { fontSize: font.size.sm, fontWeight: '700' },
})
