import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import {
  getAccounts, createAccount, deleteAccount, getTrades, getExecutions,
  getAdminMirror, getSubscriberTrades, getSharedAccountTrades, createTrade, getStockPrice,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'
import ExecutionPanel from '../../components/ExecutionPanel'
import { getCurrentQty, getUnrealisedPnl, getRealisedPnl } from '../../lib/calculations'

const fmtd = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtM = (n: number) => {
  const a = Math.abs(n)
  if (a >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`
  if (a >= 100_000)    return `₹${(n / 100_000).toFixed(2)} L`
  return `₹${fmt0(n)}`
}

const EMPTY_TRADE = {
  ticker: '',
  direction: 'LONG',
  entry_date: new Date().toISOString().slice(0, 10),
  entry_price: '',
  quantity: '',
  invested_capital: '',
  actual_investment: '',
  mtf_interest_rate: '',
  notes: '',
}

export default function AccountsScreen() {
  const { session, role } = useAuth()
  const isAdmin = role === 'admin'

  const [accounts,          setAccounts]         = useState<any[]>([])
  const [ownTrades,         setOwnTrades]         = useState<any[]>([])
  const [mirroredAccounts,  setMirroredAccounts]  = useState<any[]>([])
  const [mirroredTradesMap, setMirroredTradesMap] = useState<Record<string, any[]>>({})
  const [sharedTrades,      setSharedTrades]      = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [refreshing,        setRefreshing]        = useState(false)
  const [expandedAccount,   setExpandedAccount]   = useState<string | null>(null)
  const [tradeFilter,       setTradeFilter]       = useState<'OPEN' | 'CLOSED'>('OPEN')

  const [addAcctModal,  setAddAcctModal]  = useState(false)
  const [newName,       setNewName]       = useState('')
  const [savingAcct,    setSavingAcct]    = useState(false)

  const [addTradeModal, setAddTradeModal] = useState(false)
  const [tradeAcct,     setTradeAcct]     = useState('')
  const [tradeForm,     setTradeForm]     = useState({ ...EMPTY_TRADE })
  const [savingTrade,   setSavingTrade]   = useState(false)
  const [livePrices,     setLivePrices]     = useState<Record<string, number>>({})
  const [ownExecsMap,    setOwnExecsMap]    = useState<Record<string, any[]>>({})
  const [mirroredExecsMap, setMirroredExecsMap] = useState<Record<string, any[]>>({})
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [acc, tr] = await Promise.all([getAccounts(), getTrades()])
      const own: any[] = Array.isArray(tr) ? tr : []
      setAccounts(Array.isArray(acc) ? acc : [])
      setOwnTrades(own)

      // Fetch own executions per trade
      const ownExMap: Record<string, any[]> = {}
      await Promise.all(own.map(async t => {
        try {
          const exs = await getExecutions(t.id)
          ownExMap[t.id] = Array.isArray(exs) ? exs : []
        } catch { ownExMap[t.id] = [] }
      }))
      setOwnExecsMap(ownExMap)

      let allOpenTrades: any[] = own.filter(t => t.status === 'OPEN')

      if (isAdmin) {
        const mirror = await getAdminMirror().catch(() => [])
        const mirrorList = Array.isArray(mirror) ? mirror : []
        setMirroredAccounts(mirrorList)
        const tradesMap: Record<string, any[]> = {}
        const mExMap: Record<string, any[]> = {}
        await Promise.all(mirrorList.map(async (m: any) => {
          try {
            const d = await getSubscriberTrades(m.subscriber_id)
            const trades: any[] = Array.isArray(d?.trades) ? d.trades : (Array.isArray(d) ? d : [])
            tradesMap[m.subscriber_id] = trades
            // Extract + index executions by trade_id
            const exsList: any[] = Array.isArray(d?.executions) ? d.executions : []
            exsList.forEach((e: any) => {
              if (mExMap[e.trade_id]) mExMap[e.trade_id].push(e)
              else mExMap[e.trade_id] = [e]
            })
            allOpenTrades = allOpenTrades.concat(trades.filter((t: any) => t.status === 'OPEN'))
          } catch { tradesMap[m.subscriber_id] = [] }
        }))
        setMirroredTradesMap(tradesMap)
        setMirroredExecsMap(mExMap)
      } else {
        const shared = await getSharedAccountTrades().catch(() => ({ trades: [] }))
        const sharedList: any[] = Array.isArray(shared?.trades) ? shared.trades : []
        setSharedTrades(sharedList)
        allOpenTrades = allOpenTrades.concat(sharedList.filter((t: any) => t.status === 'OPEN'))
      }

      // Fetch live prices for ALL open trades (own + mirrored/shared)
      const openTickers = [...new Set(allOpenTrades.map((t: any) => t.ticker as string))]
      openTickers.forEach(async ticker => {
        try {
          const d = await getStockPrice(ticker)
          if (d?.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price }))
        } catch {}
      })
    } catch { /* empty */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  const handleAddAccount = async () => {
    if (!newName.trim()) return
    setSavingAcct(true)
    try {
      await createAccount(newName.trim())
      setNewName(''); setAddAcctModal(false)
      load()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setSavingAcct(false) }
  }

  const handleDeleteAccount = (id: string, name: string) =>
    Alert.alert('Delete Account', `Delete "${name}"? Trades in this account will be unlinked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteAccount(id, name); load() }
        catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])

  const openAddTrade = (accName: string) => {
    setTradeAcct(accName)
    setTradeForm({ ...EMPTY_TRADE })
    setAddTradeModal(true)
  }

  const handleOpenTap = (key: string) => {
    if (expandedAccount === key && tradeFilter === 'OPEN') {
      setExpandedAccount(null)
    } else {
      setExpandedAccount(key)
      setTradeFilter('OPEN')
    }
  }

  const handleClosedTap = (key: string) => {
    if (expandedAccount === key && tradeFilter === 'CLOSED') {
      setExpandedAccount(null)
    } else {
      setExpandedAccount(key)
      setTradeFilter('CLOSED')
    }
  }

  const handleAddTrade = async () => {
    const { ticker, direction, entry_date, entry_price, quantity,
            invested_capital, actual_investment, mtf_interest_rate, notes } = tradeForm
    if (!ticker.trim()) { Alert.alert('Error', 'Enter a ticker'); return }
    if (!entry_price || !quantity) { Alert.alert('Error', 'Entry price and quantity required'); return }
    setSavingTrade(true)
    try {
      const qty   = parseFloat(quantity)
      const price = parseFloat(entry_price)
      const ic    = invested_capital ? parseFloat(invested_capital) : price * qty
      await createTrade({
        account: tradeAcct,
        ticker: ticker.trim().toUpperCase(),
        direction,
        entry_date,
        entry_price: price,
        quantity: qty,
        invested_capital: ic,
        actual_investment: actual_investment ? parseFloat(actual_investment) : null,
        mtf_interest_rate: mtf_interest_rate ? parseFloat(mtf_interest_rate) : null,
        notes: notes || null,
        status: 'OPEN',
        trade_type: 'NORMAL',
      })
      setAddTradeModal(false)
      load()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setSavingTrade(false) }
  }

  const ownStatsFor = (name: string) => {
    const ts      = ownTrades.filter(t => t.account === name)
    const open    = ts.filter(t => t.status === 'OPEN')
    const invested = open.reduce((s, t) => s + Number(t.invested_capital || 0), 0)
    // Exec-based realised across ALL trades (includes partial exits from OPEN)
    const realised = ts.reduce((s, t) => s + getRealisedPnl(t, ownExecsMap[t.id] || []), 0)
    // Unrealised: uses currentQty (total qty minus sold qty)
    let unrealised = 0
    let hasLive    = false
    open.forEach(t => {
      const cmp = livePrices[t.ticker]
      if (cmp) {
        unrealised += getUnrealisedPnl(t, ownExecsMap[t.id] || [], cmp)
        hasLive = true
      }
    })
    const mtf = ts.filter(t => t.trade_type === 'MTF' && t.status === 'OPEN')
    return { open: open.length, closed: ts.filter(t => t.status === 'CLOSED').length, invested, realised, unrealised, hasLive, mtfCount: mtf.length, trades: ts }
  }

  const mirroredStatsFor = (subId: string) => {
    const ts      = mirroredTradesMap[subId] || []
    const open    = ts.filter((t: any) => t.status === 'OPEN')
    const invested = open.reduce((s: number, t: any) => s + Number(t.invested_capital || 0), 0)
    // Exec-based realised across ALL trades
    const realised = ts.reduce((s: number, t: any) => s + getRealisedPnl(t, mirroredExecsMap[t.id] || []), 0)
    return { open: open.length, closed: ts.filter((t: any) => t.status === 'CLOSED').length, invested, realised, trades: ts }
  }

  const sharedAccountNames = [...new Set(sharedTrades.map(t => t.account).filter(Boolean))]

  if (loading)
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.accent} />}
        contentContainerStyle={s.list}
      >
        {/* Add account button */}
        {isAdmin && (
          <TouchableOpacity style={s.addAcctBtn} onPress={() => setAddAcctModal(true)}>
            <Text style={s.addAcctBtnText}>+ Add Account</Text>
          </TouchableOpacity>
        )}

        {/* ── Own accounts ── */}
        {accounts.length === 0 && !isAdmin ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No accounts yet</Text>
          </View>
        ) : (
          accounts.map(acc => {
            const st             = ownStatsFor(acc.name)
            const key            = acc.id
            const isOpenActive   = expandedAccount === key && tradeFilter === 'OPEN'
            const isClosedActive = expandedAccount === key && tradeFilter === 'CLOSED'
            const visibleTrades  = expandedAccount === key
              ? st.trades.filter(t => t.status === tradeFilter)
              : []
            return (
              <View key={key}>
                <View style={[s.tile, (isOpenActive || isClosedActive) && s.tileActive]}>
                  <View style={s.tileHead}>
                    <Text style={s.tileName}>{acc.name}</Text>
                    <View style={s.tileActions}>
                      <TouchableOpacity style={s.addTradeBtn} onPress={() => openAddTrade(acc.name)}>
                        <Text style={s.addTradeBtnText}>+ Trade</Text>
                      </TouchableOpacity>
                      {isAdmin && (
                        <TouchableOpacity onPress={() => handleDeleteAccount(acc.id, acc.name)} hitSlop={8}>
                          <Text style={s.delText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Tappable Open / Closed filter tiles */}
                  <View style={s.filterRow}>
                    <TouchableOpacity
                      style={[s.filterTile, isOpenActive && s.filterTileOpenActive]}
                      onPress={() => handleOpenTap(key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.filterCount, { color: isOpenActive ? colors.green : colors.accent }]}>{st.open}</Text>
                      <Text style={[s.filterLabel, isOpenActive && { color: colors.green }]}>{'Open\nTrades'}</Text>
                      {st.hasLive
                        ? <Text style={[s.filterPnl, { color: st.unrealised >= 0 ? colors.green : colors.red }]}>
                            {st.unrealised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(st.unrealised))}
                          </Text>
                        : st.open > 0
                          ? <Text style={s.filterPnlMuted}>CMP…</Text>
                          : null
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.filterTile, isClosedActive && s.filterTileClosedActive]}
                      onPress={() => handleClosedTap(key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.filterCount, { color: isClosedActive ? colors.muted : colors.text }]}>{st.closed}</Text>
                      <Text style={[s.filterLabel, isClosedActive && { color: colors.muted }]}>{'Closed\nTrades'}</Text>
                      {st.closed > 0 && (
                        <Text style={[s.filterPnl, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                          {st.realised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(st.realised))}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={s.statRow}>
                    <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(st.invested)}</Text></View>
                    <View style={s.stat}>
                      <Text style={s.statLabel}>REALISED</Text>
                      <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                        {st.realised >= 0 ? '+' : '−'}{fmtM(Math.abs(st.realised))}
                      </Text>
                    </View>
                  </View>

                  {st.mtfCount > 0 && (
                    <View style={s.mtfRow}><Text style={s.mtfText}>MTF: {st.mtfCount} open positions</Text></View>
                  )}
                </View>

                {expandedAccount === key && (
                  <View style={s.tradeList}>
                    {visibleTrades.length === 0 ? (
                      <Text style={s.noTrades}>No {tradeFilter.toLowerCase()} trades</Text>
                    ) : (
                      visibleTrades.map(t => {
                        const isOpen  = t.status === 'OPEN'
                        const pnl     = !isOpen
                          ? (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
                          : null
                        const cmpRow  = isOpen ? livePrices[t.ticker] : null
                        const uPnl    = cmpRow
                          ? (t.direction === 'LONG' ? 1 : -1) * (cmpRow - Number(t.entry_price)) * Number(t.quantity)
                          : null
                        const showExec = expandedExecId === t.id
                        return (
                          <View key={t.id}>
                            <View style={[s.tradeRow, isOpen ? s.tradeOpen : s.tradeClosed]}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <Text style={s.tradeTicker}>{t.ticker}</Text>
                                  <View style={[s.dirBadge, t.direction === 'LONG' ? s.dirLong : s.dirShort]}>
                                    <Text style={[s.dirBadgeText, { color: t.direction === 'LONG' ? colors.accent : colors.red }]}>
                                      {t.direction === 'LONG' ? '▲' : '▼'} {t.direction}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)}  ·  Entry ₹{fmtd(t.entry_price)}</Text>
                                {isOpen ? (
                                  <>
                                    <Text style={s.tradeMeta}>Qty {fmt0(t.quantity)}  ·  Inv ₹{fmtd(t.invested_capital || Number(t.entry_price) * Number(t.quantity))}</Text>
                                    {cmpRow != null && (
                                      <Text style={s.tradeMeta}>
                                        {'CMP ₹'}{fmtd(cmpRow)}{'  ·  '}
                                        <Text style={{ color: (uPnl ?? 0) >= 0 ? colors.green : colors.red, fontWeight: '700' }}>
                                          {(uPnl ?? 0) >= 0 ? '+' : '−'}₹{fmtd(Math.abs(uPnl ?? 0))}
                                        </Text>
                                      </Text>
                                    )}
                                  </>
                                ) : (
                                  <Text style={s.tradeMeta}>Exit ₹{fmtd(t.exit_price)}  ·  Qty {fmt0(t.quantity)}</Text>
                                )}
                                <TouchableOpacity onPress={() => setExpandedExecId(showExec ? null : t.id)} style={{ marginTop: 4 }}>
                                  <Text style={s.execToggle}>
                                    {showExec ? '▲ Hide Executions' : '▼ Executions'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              {pnl !== null && (
                                <Text style={[s.tradePnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                                  {pnl >= 0 ? '+' : '−'}₹{fmtd(Math.abs(pnl))}
                                </Text>
                              )}
                            </View>
                            {showExec && (
                              <ExecutionPanel
                                trade={t}
                                onUpdate={load}
                                isReadOnly={false}
                              />
                            )}
                          </View>
                        )
                      })
                    )}
                  </View>
                )}
              </View>
            )
          })
        )}

        {/* ── Mirrored subscriber accounts (admin only) ── */}
        {isAdmin && mirroredAccounts.length > 0 && (
          <>
            <Text style={s.sectionLabel}>MIRRORED SUBSCRIBER ACCOUNTS</Text>
            {mirroredAccounts.map((m: any) => {
              const subId          = m.subscriber_id
              const subName        = (m.subscriber_name || m.subscriber_email || 'Subscriber').split(' ')[0]
              const st             = mirroredStatsFor(subId)
              const key            = `mirror-${subId}`
              const isOpenActive   = expandedAccount === key && tradeFilter === 'OPEN'
              const isClosedActive = expandedAccount === key && tradeFilter === 'CLOSED'
              const visibleTrades  = (expandedAccount === key)
                ? st.trades.filter((t: any) => (t.status || '').toUpperCase() === tradeFilter)
                : []
              return (
                <View key={key}>
                  <View style={[s.tile, s.tileMirrored, (isOpenActive || isClosedActive) && s.tileActive]}>
                    <View style={s.tileHead}>
                      <View>
                        <Text style={s.tileName}>{subName}'s Accounts</Text>
                        <Text style={s.tileSubEmail}>{m.subscriber_email}</Text>
                      </View>
                      <View style={s.mirrorBadge}><Text style={s.mirrorText}>MIRRORED</Text></View>
                    </View>

                    <View style={s.filterRow}>
                      <TouchableOpacity
                        style={[s.filterTile, isOpenActive && s.filterTileOpenActive]}
                        onPress={() => handleOpenTap(key)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.filterCount, { color: isOpenActive ? colors.green : colors.accent }]}>{st.open}</Text>
                        <Text style={[s.filterLabel, isOpenActive && { color: colors.green }]}>{'Open\nTrades'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.filterTile, isClosedActive && s.filterTileClosedActive]}
                        onPress={() => handleClosedTap(key)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.filterCount, { color: isClosedActive ? colors.muted : colors.text }]}>{st.closed}</Text>
                        <Text style={[s.filterLabel, isClosedActive && { color: colors.muted }]}>{'Closed\nTrades'}</Text>
                        {st.closed > 0 && (
                          <Text style={[s.filterPnl, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                            {st.realised >= 0 ? '+' : '−'}₹{fmtd(Math.abs(st.realised))}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={s.statRow}>
                      <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(st.invested)}</Text></View>
                      <View style={s.stat}>
                        <Text style={s.statLabel}>REALISED</Text>
                        <Text style={[s.statVal, { color: st.realised >= 0 ? colors.green : colors.red }]}>
                          {st.realised >= 0 ? '+' : '−'}{fmtM(Math.abs(st.realised))}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {(isOpenActive || isClosedActive) && (
                    <View style={s.tradeList}>
                      {visibleTrades.length === 0 ? (
                        <Text style={s.noTrades}>No {tradeFilter.toLowerCase()} trades</Text>
                      ) : (
                        visibleTrades.map((t: any) => {
                          const isOpen   = t.status === 'OPEN'
                          const pnl      = !isOpen
                            ? (t.direction === 'LONG' ? 1 : -1) * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
                            : null
                          const showExec = expandedExecId === t.id
                          return (
                            <View key={t.id}>
                              <View style={[s.tradeRow, isOpen ? s.tradeOpen : s.tradeClosed]}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Text style={s.tradeTicker}>{t.ticker}</Text>
                                    <View style={[s.dirBadge, t.direction === 'LONG' ? s.dirLong : s.dirShort]}>
                                      <Text style={[s.dirBadgeText, { color: t.direction === 'LONG' ? colors.accent : colors.red }]}>
                                        {t.direction === 'LONG' ? '▲' : '▼'} {t.direction}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)}  ·  Entry ₹{fmtd(t.entry_price)}</Text>
                                  {isOpen ? (
                                    <Text style={s.tradeMeta}>Qty {fmt0(t.quantity)}  ·  {t.account || ''}</Text>
                                  ) : (
                                    <Text style={s.tradeMeta}>Exit ₹{fmtd(t.exit_price)}  ·  Qty {fmt0(t.quantity)}</Text>
                                  )}
                                  <TouchableOpacity onPress={() => setExpandedExecId(showExec ? null : t.id)} style={{ marginTop: 4 }}>
                                    <Text style={s.execToggle}>
                                      {showExec ? '▲ Hide Executions' : '▼ Executions'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                                {pnl !== null && (
                                  <Text style={[s.tradePnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                                    {pnl >= 0 ? '+' : '−'}₹{fmtd(Math.abs(pnl))}
                                  </Text>
                                )}
                              </View>
                              {showExec && (
                                <ExecutionPanel
                                  trade={t}
                                  onUpdate={load}
                                  isReadOnly={true}
                                />
                              )}
                            </View>
                          )
                        })
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}

        {/* ── Shared admin accounts (subscriber only) ── */}
        {!isAdmin && sharedAccountNames.length > 0 && (
          <>
            <Text style={s.sectionLabel}>SHARED BY ADMIN</Text>
            {sharedAccountNames.map(accName => {
              const accTrades = sharedTrades.filter(t => t.account === accName)
              const open      = accTrades.filter(t => t.status === 'OPEN')
              const closed    = accTrades.filter(t => t.status === 'CLOSED')
              const invested  = open.reduce((sum: number, t: any) => sum + Number(t.invested_capital || 0), 0)
              const realised  = closed.reduce((sum: number, t: any) => {
                const sign = t.direction === 'LONG' ? 1 : -1
                return sum + sign * (Number(t.exit_price || 0) - Number(t.entry_price)) * Number(t.quantity)
              }, 0)
              const key   = `shared-${accName}`
              const isExp = expandedAccount === key
              return (
                <View key={key}>
                  <TouchableOpacity
                    style={[s.tile, s.tileShared, isExp && s.tileActive]}
                    onPress={() => setExpandedAccount(isExp ? null : key)}
                    activeOpacity={0.8}
                  >
                    <View style={s.tileHead}>
                      <Text style={s.tileName}>{accName}</Text>
                      <View style={s.readOnlyBadge}><Text style={s.readOnlyText}>READ ONLY</Text></View>
                    </View>
                    <View style={s.statRow}>
                      <View style={s.stat}><Text style={s.statLabel}>OPEN</Text><Text style={[s.statVal, { color: colors.accent }]}>{open.length}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>CLOSED</Text><Text style={s.statVal}>{closed.length}</Text></View>
                      <View style={s.stat}><Text style={s.statLabel}>INVESTED</Text><Text style={s.statVal}>{fmtM(invested)}</Text></View>
                      <View style={s.stat}>
                        <Text style={s.statLabel}>REALISED</Text>
                        <Text style={[s.statVal, { color: realised >= 0 ? colors.green : colors.red }]}>
                          {realised >= 0 ? '+' : '−'}{fmtM(Math.abs(realised))}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.expandHint}>{isExp ? '▲ Hide trades' : '▼ Show trades'}</Text>
                  </TouchableOpacity>
                  {isExp && (
                    <View style={s.tradeList}>
                      {accTrades.length === 0 ? <Text style={s.noTrades}>No trades</Text> : accTrades.slice(0, 30).map((t: any) => (
                        <View key={t.id} style={[s.tradeRow, t.status === 'OPEN' ? s.tradeOpen : s.tradeClosed]}>
                          <View>
                            <Text style={s.tradeTicker}>{t.ticker}</Text>
                            <Text style={s.tradeMeta}>{t.entry_date?.slice(0, 10)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.tradeDir}>{t.direction}</Text>
                            <Text style={s.tradeStatus}>{t.status}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Add Account Modal */}
      <Modal visible={addAcctModal} transparent animationType="fade" onRequestClose={() => setAddAcctModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>New Account</Text>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Account name (e.g. Zerodha)"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddAcctModal(false); setNewName('') }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingAcct && { opacity: 0.6 }]} onPress={handleAddAccount} disabled={savingAcct}>
                <Text style={s.saveText}>{savingAcct ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Trade Modal */}
      <Modal visible={addTradeModal} transparent animationType="slide" onRequestClose={() => setAddTradeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '88%' }]}>
            <Text style={s.modalTitle}>New Trade — {tradeAcct}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={s.fieldLabel}>TICKER</Text>
              <TextInput
                style={s.input}
                value={tradeForm.ticker}
                onChangeText={v => setTradeForm(f => ({ ...f, ticker: v.toUpperCase() }))}
                placeholder="e.g. RELIANCE"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
              />

              <Text style={s.fieldLabel}>DIRECTION</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                {(['LONG', 'SHORT'] as const).map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[s.dirBtn, tradeForm.direction === d && s.dirBtnActive]}
                    onPress={() => setTradeForm(f => ({ ...f, direction: d }))}
                  >
                    <Text style={[s.dirBtnText, tradeForm.direction === d && s.dirBtnTextActive]}>
                      {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>ENTRY DATE</Text>
              <TextInput
                style={s.input}
                value={tradeForm.entry_date}
                onChangeText={v => setTradeForm(f => ({ ...f, entry_date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>ENTRY PRICE ₹</Text>
                  <TextInput
                    style={s.input}
                    value={tradeForm.entry_price}
                    onChangeText={v => {
                      const price = parseFloat(v) || 0
                      const qty   = parseFloat(tradeForm.quantity) || 0
                      setTradeForm(f => ({
                        ...f,
                        entry_price: v,
                        invested_capital: price && qty ? (price * qty).toFixed(2) : f.invested_capital,
                      }))
                    }}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>QUANTITY</Text>
                  <TextInput
                    style={s.input}
                    value={tradeForm.quantity}
                    onChangeText={v => {
                      const qty   = parseFloat(v) || 0
                      const price = parseFloat(tradeForm.entry_price) || 0
                      setTradeForm(f => ({
                        ...f,
                        quantity: v,
                        invested_capital: price && qty ? (price * qty).toFixed(2) : f.invested_capital,
                      }))
                    }}
                    placeholder="100"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={s.fieldLabel}>INVESTED CAPITAL ₹  <Text style={{ fontWeight: '400', color: colors.muted }}>(auto-calculated)</Text></Text>
              <TextInput
                style={s.input}
                value={tradeForm.invested_capital}
                onChangeText={v => setTradeForm(f => ({ ...f, invested_capital: v }))}
                placeholder="Entry × Qty"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />

              <Text style={s.fieldLabel}>ACTUAL INVESTMENT ₹  <Text style={{ fontWeight: '400', color: colors.muted }}>(your margin — MTF)</Text></Text>
              <TextInput
                style={s.input}
                value={tradeForm.actual_investment}
                onChangeText={v => setTradeForm(f => ({ ...f, actual_investment: v }))}
                placeholder="Amount from your pocket"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />

              <Text style={s.fieldLabel}>MTF INTEREST RATE %  <Text style={{ fontWeight: '400', color: colors.muted }}>(annual, 0 if none)</Text></Text>
              <TextInput
                style={s.input}
                value={tradeForm.mtf_interest_rate}
                onChangeText={v => setTradeForm(f => ({ ...f, mtf_interest_rate: v }))}
                placeholder="e.g. 18"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />

              <Text style={s.fieldLabel}>NOTES  <Text style={{ fontWeight: '400', color: colors.muted }}>(optional)</Text></Text>
              <TextInput
                style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={tradeForm.notes}
                onChangeText={v => setTradeForm(f => ({ ...f, notes: v }))}
                placeholder="Strategy, setup, notes..."
                placeholderTextColor={colors.muted}
                multiline
              />

            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAddTradeModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, savingTrade && { opacity: 0.6 }]} onPress={handleAddTrade} disabled={savingTrade}>
                <Text style={s.saveText}>{savingTrade ? 'Adding…' : 'Add Trade'}</Text>
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
  list:      { padding: spacing.lg, paddingBottom: 80 },

  addAcctBtn:     { backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  addAcctBtnText: { color: colors.white, fontWeight: '700', fontSize: font.size.md },

  sectionLabel: { fontSize: font.size.xs, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },

  emptyBox:  { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: font.size.xl, fontWeight: '700', color: colors.border2 },

  tile:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.border2 },
  tileActive:  { borderLeftColor: colors.accent, borderColor: colors.accent },
  tileMirrored:{ borderLeftColor: colors.gold },
  tileShared:  { borderLeftColor: colors.accent, borderWidth: 2, borderColor: colors.accent },
  tileHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  tileName:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  tileSubEmail:{ fontSize: font.size.xs, color: colors.muted, marginTop: 2 },
  tileActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addTradeBtn:     { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 4 },
  addTradeBtnText: { fontSize: font.size.xs, color: colors.white, fontWeight: '700' },
  delText:         { fontSize: font.size.sm, color: colors.red, fontWeight: '600' },

  mirrorBadge:   { backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  mirrorText:    { fontSize: font.size.xs, color: colors.gold, fontWeight: '700' },
  readOnlyBadge: { backgroundColor: colors.accentDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  readOnlyText:  { fontSize: font.size.xs, color: colors.accent2, fontWeight: '700' },

  filterRow:             { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  filterTile:            { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  filterTileOpenActive:  { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.4)' },
  filterTileClosedActive:{ backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.35)' },
  filterCount:           { fontSize: font.size.h2, fontWeight: '800', marginBottom: 2 },
  filterLabel:           { fontSize: font.size.xs, color: colors.muted, textAlign: 'center', lineHeight: 14 },
  filterPnl:             { fontSize: font.size.xs, fontWeight: '700', marginTop: 3 },
  filterPnlMuted:        { fontSize: font.size.xs, color: colors.muted, marginTop: 3 },

  statRow:   { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  stat:      { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  statLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  statVal:   { fontSize: font.size.sm, fontWeight: '800', color: colors.text },

  mtfRow:  { backgroundColor: '#fef9c3', borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  mtfText: { fontSize: font.size.xs, color: '#92400e', fontWeight: '600' },

  expandHint: { fontSize: font.size.xs, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },

  tradeList: { backgroundColor: colors.surface2, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden' },
  noTrades:  { padding: spacing.lg, color: colors.muted, textAlign: 'center' },
  tradeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tradeOpen:   { borderLeftWidth: 3, borderLeftColor: colors.accent },
  tradeClosed: { borderLeftWidth: 3, borderLeftColor: colors.border2 },
  tradeTicker: { fontSize: 15, fontWeight: '800', color: colors.text },
  tradeMeta:   { fontSize: 13, color: colors.muted, marginTop: 2 },
  tradeDir:    { fontSize: font.size.xs, color: colors.muted, fontWeight: '700' },
  tradeStatus: { fontSize: font.size.xs, color: colors.muted },
  tradePnl:    { fontSize: 14, fontWeight: '700', marginTop: 2 },

  dirBadge:     { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  dirLong:      { backgroundColor: 'rgba(14,165,233,0.1)', borderColor: 'rgba(14,165,233,0.3)' },
  dirShort:     { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  dirBadgeText: { fontSize: 11, fontWeight: '700' },
  execToggle:   { fontSize: font.size.xs, color: colors.accent, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl },
  modalBox:     { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  modalTitle:   { fontSize: font.size.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  fieldLabel:   { fontSize: font.size.xs, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.md, color: colors.text, marginBottom: spacing.xs,
  },
  dirBtn:          { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  dirBtnActive:    { borderColor: colors.accent, backgroundColor: colors.accentDim },
  dirBtnText:      { fontSize: font.size.sm, fontWeight: '700', color: colors.muted },
  dirBtnTextActive:{ color: colors.accent },
  modalBtns:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  saveText:   { color: colors.white, fontWeight: '700' },
})
