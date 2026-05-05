import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import {
  getTrades, getExecutions, getStockPrice, getAdminMirror,
  getSubscriberTrades, getSharedAccountTrades,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

const fmt0  = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtd  = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtM  = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`
  if (a >= 100_000)    return `₹${(n / 100_000).toFixed(2)} L`
  return `₹${fmt0(n)}`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function calcMTF(tradeList: any[]) {
  return tradeList.reduce((s, t) => {
    if (!t.mtf_interest_rate || !t.entry_date) return s
    const totalVal = Number(t.invested_capital) || (Number(t.entry_price) * Number(t.quantity))
    if (!totalVal) return s
    const margin = Number(t.actual_investment) || 0
    const base = margin > 0 ? totalVal - margin : totalVal
    if (base <= 0) return s
    const end = t.status === 'CLOSED' && t.exit_date ? new Date(t.exit_date) : new Date()
    const entry = new Date(t.entry_date)
    const days = Math.max(1, Math.floor((end.getTime() - entry.getTime()) / 86400000))
    return s + (base * Number(t.mtf_interest_rate) * days) / 36500
  }, 0)
}

function calcRealisedForTrade(trade: any, execs: any[]): number {
  return (execs || []).reduce((sum, e) =>
    sum + (Number(e.price) - Number(trade.entry_price)) * Number(e.quantity), 0)
}

// ── P&L Calendar ────────────────────────────────────────────────────────────
function PnLCalendar({ trades, execsMap }: { trades: any[]; execsMap: Record<string, any[]> }) {
  const [month, setMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Match web: group by exit_date, exec-based P&L per trade
  const dailyPnL: Record<string, number> = {}
  trades.filter(t => t.status === 'CLOSED' && t.exit_date).forEach(t => {
    const key   = t.exit_date.slice(0, 10)
    const execs = execsMap[t.id] || []
    const pnl   = execs.length > 0
      ? execs.reduce((s: number, e: any) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
      : (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
    dailyPnL[key] = (dailyPnL[key] || 0) + pnl
  })

  const year        = month.getFullYear()
  const mon         = month.getMonth()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const firstDow    = new Date(year, mon, 1).getDay()
  const todayStr    = new Date().toISOString().slice(0, 10)
  const monthKey    = `${year}-${String(mon + 1).padStart(2, '0')}`
  const monthLabel  = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const monthTotal = Object.entries(dailyPnL)
    .filter(([k]) => k.startsWith(monthKey))
    .reduce((s, [, v]) => s + v, 0)

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const dayTrades = selectedDate
    ? trades.filter(t => t.status === 'CLOSED' && t.exit_date?.slice(0, 10) === selectedDate)
    : []

  const prevMonth = () => { setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedDate(null) }
  const nextMonth = () => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedDate(null) }

  return (
    <View style={cal.wrap}>
      <View style={cal.head}>
        <TouchableOpacity onPress={prevMonth}><Text style={cal.arrow}>‹</Text></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={cal.month}>{monthLabel}</Text>
          {monthTotal !== 0 && (
            <Text style={[cal.monthTotal, { color: monthTotal >= 0 ? colors.green : colors.red }]}>
              {monthTotal >= 0 ? '+' : '−'}₹{fmt0(Math.abs(monthTotal))}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={nextMonth}><Text style={cal.arrow}>›</Text></TouchableOpacity>
      </View>

      <View style={cal.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={cal.weekDay}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={cal.dayEmpty} />
          const dateStr  = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const pnl      = dailyPnL[dateStr]
          const isToday  = dateStr === todayStr
          const isSel    = dateStr === selectedDate
          return (
            <TouchableOpacity
              key={dateStr}
              activeOpacity={pnl != null ? 0.7 : 1}
              onPress={() => {
                if (pnl == null) return
                setSelectedDate(prev => prev === dateStr ? null : dateStr)
              }}
              style={[
                cal.day,
                pnl != null && (pnl >= 0 ? cal.dayProfit : cal.dayLoss),
                isToday && cal.dayToday,
                isSel && cal.daySelected,
              ]}
            >
              <Text style={[cal.dayNum, isToday && cal.dayNumToday, isSel && { fontWeight: '800' }]}>{day}</Text>
              {pnl != null && (
                <Text style={[cal.dayPnl, { color: pnl >= 0 ? colors.green : colors.red }]} numberOfLines={1}>
                  {pnl >= 0 ? '+' : '−'}{Math.abs(pnl) >= 10000 ? `${(Math.abs(pnl) / 1000).toFixed(0)}k` : fmt0(Math.abs(pnl))}
                </Text>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Day detail — trades closed on selectedDate */}
      {selectedDate && dayTrades.length > 0 && (
        <View style={cal.detail}>
          <View style={cal.detailHead}>
            <Text style={cal.detailTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={[cal.detailTotal, { color: (dailyPnL[selectedDate] || 0) >= 0 ? colors.green : colors.red }]}>
              {(dailyPnL[selectedDate] || 0) >= 0 ? '+' : '−'}₹{fmtd(Math.abs(dailyPnL[selectedDate] || 0))}
            </Text>
          </View>
          {dayTrades.map(t => {
            const execs = execsMap[t.id] || []
            const pnl   = execs.length > 0
              ? execs.reduce((s: number, e: any) => s + (Number(e.price) - Number(t.entry_price)) * Number(e.quantity), 0)
              : (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
            return (
              <View key={t.id} style={cal.detailRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={cal.detailTicker}>{t.ticker}</Text>
                    <View style={[cal.dirBadge, t.direction === 'LONG' ? cal.dirLong : cal.dirShort]}>
                      <Text style={[cal.dirBadgeText, { color: t.direction === 'LONG' ? colors.accent : colors.red }]}>
                        {t.direction}
                      </Text>
                    </View>
                  </View>
                  <Text style={cal.detailMeta}>₹{fmtd(t.entry_price)} → ₹{fmtd(t.exit_price)}  ·  Qty {fmt0(t.quantity)}</Text>
                </View>
                <Text style={[cal.detailPnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                  {pnl >= 0 ? '+' : '−'}₹{fmtd(Math.abs(pnl))}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { session, role } = useAuth()
  const isAdmin = role === 'admin'

  const [ownTrades,         setOwnTrades]        = useState<any[]>([])
  const [ownExecsMap,       setOwnExecsMap]       = useState<Record<string, any[]>>({})
  const [mirroredAccounts,  setMirroredAccounts]  = useState<any[]>([])
  const [mirroredMap,       setMirroredMap]       = useState<Record<string, { trades: any[]; execs: Record<string, any[]> }>>({})
  const [sharedTrades,      setSharedTrades]      = useState<any[]>([])
  const [sharedExecsMap,    setSharedExecsMap]    = useState<Record<string, any[]>>({})
  const [livePrices,        setLivePrices]        = useState<Record<string, number>>({})
  const [loading,           setLoading]           = useState(true)
  const [refreshing,        setRefreshing]        = useState(false)
  const pricesLoaded = useRef(false)

  const fetchPrices = useCallback((tradeList: any[]) => {
    const tickers = [...new Set(tradeList.filter(t => t.status === 'OPEN').map(t => t.ticker))]
    tickers.forEach(async ticker => {
      try {
        const d = await getStockPrice(ticker)
        if (d?.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price }))
      } catch {}
    })
  }, [])

  const load = useCallback(async () => {
    try {
      const tradesRaw = await getTrades()
      const own: any[] = Array.isArray(tradesRaw) ? tradesRaw : []
      setOwnTrades(own)

      const ownExMap: Record<string, any[]> = {}
      await Promise.all(own.map(async t => {
        try {
          const exs = await getExecutions(t.id)
          ownExMap[t.id] = Array.isArray(exs) ? exs : []
        } catch { ownExMap[t.id] = [] }
      }))
      setOwnExecsMap(ownExMap)

      if (isAdmin) {
        const mirror = await getAdminMirror().catch(() => [])
        const accounts: any[] = Array.isArray(mirror) ? mirror : []
        setMirroredAccounts(accounts)

        const mMap: Record<string, { trades: any[]; execs: Record<string, any[]> }> = {}
        await Promise.all(accounts.map(async (m: any) => {
          try {
            const d = await getSubscriberTrades(m.subscriber_id)
            const trades: any[] = Array.isArray(d?.trades) ? d.trades : []
            const execsList: any[] = Array.isArray(d?.executions) ? d.executions : []
            const exMap: Record<string, any[]> = {}
            trades.forEach(t => { exMap[t.id] = [] })
            execsList.forEach((e: any) => {
              if (exMap[e.trade_id]) exMap[e.trade_id].push(e)
              else exMap[e.trade_id] = [e]
            })
            mMap[m.subscriber_id] = { trades, execs: exMap }
          } catch { mMap[m.subscriber_id] = { trades: [], execs: {} } }
        }))
        setMirroredMap(mMap)

        const allForPrices = [...own, ...Object.values(mMap).flatMap(v => v.trades)]
        if (!pricesLoaded.current) { fetchPrices(allForPrices); pricesLoaded.current = true }
      } else {
        const shared = await getSharedAccountTrades().catch(() => ({ trades: [], executions: [] }))
        const sharedList: any[] = Array.isArray(shared?.trades) ? shared.trades : []
        const sharedExsList: any[] = Array.isArray(shared?.executions) ? shared.executions : []
        const sExMap: Record<string, any[]> = {}
        sharedList.forEach(t => { sExMap[t.id] = [] })
        sharedExsList.forEach((e: any) => {
          if (sExMap[e.trade_id]) sExMap[e.trade_id].push(e)
          else sExMap[e.trade_id] = [e]
        })
        setSharedTrades(sharedList)
        setSharedExecsMap(sExMap)

        const allForPrices = [...own, ...sharedList]
        if (!pricesLoaded.current) { fetchPrices(allForPrices); pricesLoaded.current = true }
      }
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [isAdmin, fetchPrices])

  useEffect(() => { load() }, [load])

  const onRefresh = () => {
    pricesLoaded.current = false
    setRefreshing(true)
    load()
  }

  // ── Combine all trades + execs ───────────────────────────────────────────
  const ownUserId = session?.user?.id

  const allMirroredExecsMap: Record<string, any[]> = {}
  const allMirroredTrades: any[] = []
  if (isAdmin) {
    Object.entries(mirroredMap)
      .filter(([subId]) => subId !== ownUserId)
      .forEach(([, v]) => {
        allMirroredTrades.push(...v.trades)
        Object.assign(allMirroredExecsMap, v.execs)
      })
  }

  const allTrades = [...ownTrades, ...allMirroredTrades, ...(!isAdmin ? sharedTrades : [])]
  const allExecsMap: Record<string, any[]> = {
    ...ownExecsMap,
    ...allMirroredExecsMap,
    ...(!isAdmin ? sharedExecsMap : {}),
  }

  const openTrades  = allTrades.filter(t => t.status === 'OPEN')
  const closedTrades = allTrades.filter(t => t.status === 'CLOSED')

  // Unrealised P&L: currentQty = trade.qty - sum(exec.qty)
  const unrealisedPnL = openTrades.reduce((sum, t) => {
    const cmp = livePrices[t.ticker]
    if (!cmp) return sum
    const execs = allExecsMap[t.id] || []
    const soldQty = execs.reduce((s, e) => s + Number(e.quantity), 0)
    const currentQty = Number(t.quantity) - soldQty
    if (currentQty <= 0) return sum
    return sum + (t.direction === 'SHORT'
      ? (Number(t.entry_price) - cmp) * currentQty
      : (cmp - Number(t.entry_price)) * currentQty)
  }, 0)
  const hasPrices = openTrades.some(t => livePrices[t.ticker])

  // Realised P&L: sum of exec-based across all trades
  const realisedPnL = allTrades.reduce((sum, t) =>
    sum + calcRealisedForTrade(t, allExecsMap[t.id] || []), 0)

  // Win rate: closed trades where exec-based P&L > 0
  const winners = closedTrades.filter(t => calcRealisedForTrade(t, allExecsMap[t.id] || []) > 0)
  const winRate  = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0

  // Capital deployed
  const capitalDeployed = openTrades.reduce((s, t) =>
    s + (Number(t.actual_investment) || Number(t.invested_capital) || 0), 0)

  // MTF interest
  const mtfInterest = calcMTF(allTrades)

  // Account breakdown — own accounts + mirrored (admin) or shared (subscriber)
  const ownAccountNames = [...new Set(ownTrades.map(t => t.account).filter(Boolean))]
  const sharedAccNames  = [...new Set(sharedTrades.map((t: any) => t.account).filter(Boolean))]
  const breakdown = isAdmin
    ? [
        ...ownAccountNames.map(name => ({
          name,
          trades: ownTrades.filter(t => t.account === name),
          execs:  ownExecsMap,
          badge:  'MINE' as const,
        })),
        ...mirroredAccounts.map((m: any) => ({
          name:   ((m.subscriber_name || m.subscriber_email || '').split(' ')[0] || 'Sub') + "'s",
          trades: mirroredMap[m.subscriber_id]?.trades || [],
          execs:  mirroredMap[m.subscriber_id]?.execs  || {},
          badge:  'MIRRORED' as const,
        })),
      ]
    : [
        ...ownAccountNames.map(name => ({
          name,
          trades: ownTrades.filter(t => t.account === name),
          execs:  ownExecsMap,
          badge:  'MINE' as const,
        })),
        ...sharedAccNames.map(name => ({
          name,
          trades: sharedTrades.filter((t: any) => t.account === name),
          execs:  sharedExecsMap,
          badge:  'SHARED' as const,
        })),
      ]

  // Recent exits (last 8)
  const recentExits = [...closedTrades]
    .sort((a, b) => {
      const da = a.exit_date || a.updated_at || ''
      const db = b.exit_date || b.updated_at || ''
      return db.localeCompare(da)
    })
    .slice(0, 8)

  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'SMK'
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )

  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Greeting */}
      <View style={s.greetCard}>
        <Text style={s.greetHi}>{getGreeting()}, {userName}!</Text>
        <Text style={s.greetDate}>{today}</Text>
        {isAdmin && mirroredAccounts.length > 0 && (
          <View style={s.mirrorBadge}>
            <Text style={s.mirrorText}>MY TRADES + {mirroredAccounts.length} MIRRORED</Text>
          </View>
        )}
      </View>

      {/* ── 5 Stat Tiles ── */}
      <Text style={s.sectionTitle}>PORTFOLIO OVERVIEW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tileRow}>
        <StatTile
          label="UNREALISED P&L"
          value={hasPrices ? (unrealisedPnL >= 0 ? '+' : '−') + fmtM(Math.abs(unrealisedPnL)) : '—'}
          sub={`${openTrades.length} open positions`}
          color={!hasPrices ? colors.muted : unrealisedPnL >= 0 ? colors.green : colors.red}
        />
        <StatTile
          label="REALISED P&L"
          value={(realisedPnL >= 0 ? '+' : '−') + fmtM(Math.abs(realisedPnL))}
          sub={`${closedTrades.length} closed trades`}
          color={closedTrades.length === 0 ? colors.muted : realisedPnL >= 0 ? colors.green : colors.red}
        />
        <StatTile
          label="WIN RATE"
          value={closedTrades.length > 0 ? `${winRate.toFixed(1)}%` : '—'}
          sub={`${winners.length}W · ${closedTrades.length - winners.length}L`}
          color={closedTrades.length === 0 ? colors.muted : winRate >= 50 ? colors.green : colors.red}
        />
        <StatTile
          label="CAPITAL DEPLOYED"
          value={fmtM(capitalDeployed)}
          sub={`${openTrades.length} positions`}
        />
        <StatTile
          label="MTF INTEREST"
          value={`₹${fmtd(mtfInterest)}`}
          sub="Accrued"
          color={colors.gold}
        />
      </ScrollView>

      {/* ── P&L Calendar ── */}
      <Text style={s.sectionTitle}>P&L CALENDAR</Text>
      <PnLCalendar trades={allTrades} execsMap={allExecsMap} />

      {/* ── Account Breakdown ── */}
      {breakdown.length > 0 && (
        <>
          <Text style={s.sectionTitle}>ACCOUNT BREAKDOWN</Text>
          <View style={s.breakdownWrap}>
            {breakdown.map(b => {
              const bOpen   = b.trades.filter((t: any) => t.status === 'OPEN')
              const bClosed = b.trades.filter((t: any) => t.status === 'CLOSED')
              const bRel    = b.trades.reduce((sum: number, t: any) =>
                sum + calcRealisedForTrade(t, b.execs[t.id] || []), 0)
              const bMtf = calcMTF(b.trades)
              let bUnreal    = 0
              let bHasPrices = false
              bOpen.forEach((t: any) => {
                const cmp = livePrices[t.ticker]
                if (!cmp) return
                const execs   = b.execs[t.id] || []
                const soldQty = execs.reduce((s: number, e: any) => s + Number(e.quantity), 0)
                const currQty = Math.max(0, Number(t.quantity) - soldQty)
                bUnreal += t.direction === 'SHORT'
                  ? (Number(t.entry_price) - cmp) * currQty
                  : (cmp - Number(t.entry_price)) * currQty
                bHasPrices = true
              })
              return (
                <View key={b.name} style={s.bCard}>
                  <View style={s.bCardHead}>
                    <Text style={s.bName}>{b.name}</Text>
                    <View style={[s.bBadge, b.badge === 'MINE' ? s.bBadgeMine : b.badge === 'MIRRORED' ? s.bBadgeMirror : s.bBadgeShared]}>
                      <Text style={[s.bBadgeText, { color: b.badge === 'MINE' ? colors.accent : b.badge === 'MIRRORED' ? colors.gold : colors.accent2 }]}>
                        {b.badge}
                      </Text>
                    </View>
                  </View>
                  <View style={s.bStats}>
                    <View style={s.bStat}>
                      <Text style={s.bStatLabel}>OPEN / CLOSE</Text>
                      <Text style={s.bStatVal}>
                        <Text style={{ color: colors.accent }}>{bOpen.length}</Text>
                        <Text style={{ color: colors.muted }}> / </Text>
                        <Text style={{ color: colors.red }}>{bClosed.length}</Text>
                      </Text>
                    </View>
                    <View style={s.bStat}>
                      <Text style={s.bStatLabel}>UNREAL.</Text>
                      <Text style={[s.bStatVal, { color: !bHasPrices ? colors.muted : bUnreal >= 0 ? colors.green : colors.red }]}>
                        {!bHasPrices ? '—' : `${bUnreal >= 0 ? '+' : '−'}₹${fmt0(Math.abs(bUnreal))}`}
                      </Text>
                    </View>
                    <View style={s.bStat}>
                      <Text style={s.bStatLabel}>REALISED</Text>
                      <Text style={[s.bStatVal, { color: bRel >= 0 ? colors.green : colors.red }]}>
                        {bRel >= 0 ? '+' : '−'}₹{fmt0(Math.abs(bRel))}
                      </Text>
                    </View>
                    <View style={s.bStat}>
                      <Text style={s.bStatLabel}>MTF INT</Text>
                      <Text style={[s.bStatVal, { color: colors.gold }]}>₹{fmtd(bMtf)}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* ── Recent Exits ── */}
      {recentExits.length > 0 && (
        <>
          <Text style={s.sectionTitle}>RECENT EXITS</Text>
          <View style={s.exitList}>
            {recentExits.map(t => {
              const pnl = calcRealisedForTrade(t, allExecsMap[t.id] || [])
              return (
                <View key={t.id} style={[s.exitRow, { borderLeftColor: pnl >= 0 ? colors.green : colors.red }]}>
                  <View>
                    <Text style={s.exitTicker}>{t.ticker}</Text>
                    <Text style={s.exitMeta}>{t.account} · {t.exit_date?.slice(0, 10)}</Text>
                  </View>
                  <Text style={[s.exitPnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                    {pnl >= 0 ? '+' : '−'}₹{fmt0(Math.abs(pnl))}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      )}
    </ScrollView>
  )
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={st.card}>
      <Text style={st.label}>{label}</Text>
      <Text style={[st.value, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={st.sub}>{sub}</Text> : null}
    </View>
  )
}

const st = StyleSheet.create({
  card:  { width: 148, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginRight: spacing.sm },
  label: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, marginBottom: spacing.sm },
  value: { fontSize: font.size.h2, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sub:   { fontSize: font.size.xs, color: colors.muted },
})

const cal = StyleSheet.create({
  wrap:       { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  head:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  arrow:      { fontSize: 20, color: colors.muted, paddingHorizontal: spacing.md },
  month:      { fontSize: font.size.md, fontWeight: '700', color: colors.text },
  monthTotal: { fontSize: font.size.xs, fontWeight: '700', marginTop: 2 },
  weekRow:    { flexDirection: 'row', marginBottom: 4 },
  weekDay:    { flex: 1, textAlign: 'center', fontSize: 10, color: colors.muted, fontWeight: '600' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  dayEmpty:   { width: '14.28%', aspectRatio: 1 },
  day:        { width: '14.28%', aspectRatio: 1, borderRadius: 4, padding: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayProfit:  { backgroundColor: 'rgba(22,163,74,0.1)', borderColor: 'rgba(22,163,74,0.3)' },
  dayLoss:    { backgroundColor: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)' },
  dayToday:   { borderColor: colors.accent },
  daySelected:{ borderWidth: 2, borderColor: colors.accent },
  dayNum:     { fontSize: 10, color: colors.muted },
  dayNumToday:{ color: colors.accent, fontWeight: '700' },
  dayPnl:     { fontSize: 7, fontWeight: '700', marginTop: 1 },

  detail:      { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  detailHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  detailTitle: { fontSize: font.size.xs, color: colors.muted, fontWeight: '700' },
  detailTotal: { fontSize: font.size.md, fontWeight: '800' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTicker:{ fontSize: font.size.md, fontWeight: '800', color: colors.text },
  detailMeta:  { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  detailPnl:   { fontSize: font.size.sm, fontWeight: '700' },
  dirBadge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  dirLong:     { backgroundColor: 'rgba(14,165,233,0.1)', borderColor: 'rgba(14,165,233,0.3)' },
  dirShort:    { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  dirBadgeText:{ fontSize: 9, fontWeight: '700' },
})

const s = StyleSheet.create({
  page:      { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: 80 },

  greetCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, borderTopWidth: 4, borderTopColor: colors.saffron,
    padding: spacing.xl, marginBottom: spacing.lg,
  },
  greetHi:   { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  greetDate: { fontSize: font.size.sm, color: colors.muted, marginTop: 4 },
  mirrorBadge: { marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  mirrorText:  { fontSize: font.size.xs, color: colors.gold, fontWeight: '700' },

  sectionTitle: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },

  tileRow: { paddingVertical: spacing.sm, paddingRight: spacing.lg, marginBottom: spacing.md },

  breakdownWrap: { gap: spacing.sm, marginBottom: spacing.md },
  bCard:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  bCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  bName:     { fontSize: font.size.md, fontWeight: '800', color: colors.text },
  bBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  bBadgeMine:   { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  bBadgeMirror: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  bBadgeShared: { backgroundColor: colors.accentDim, borderColor: '#bae6fd' },
  bBadgeText:   { fontSize: font.size.xs, fontWeight: '700' },
  bStats:    { flexDirection: 'row', gap: spacing.xs },
  bStat:     { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  bStatLabel:{ fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  bStatVal:  { fontSize: font.size.sm, fontWeight: '800', color: colors.text },

  exitList: { gap: spacing.sm, marginBottom: spacing.md },
  exitRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 4 },
  exitTicker: { fontSize: font.size.md, fontWeight: '800', color: colors.text },
  exitMeta:   { fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  exitPnl:    { fontSize: font.size.md, fontWeight: '800' },
})
