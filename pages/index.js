import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import AddTradeModal from '../components/AddTradeModal'
import { differenceInDays, format } from 'date-fns'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label:'Dashboard', path:'/dashboard' },
    { label:'Accounts', path:'/accounts' },
    { label:'Main Page', path:'/' },
    ...(isAdmin ? [{ label:'Subscribers', path:'/subscribers' }] : []),
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px' }}>
      {items.map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 22px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600, letterSpacing:'0.05em',
          background: active===label ? 'var(--accent)' : 'transparent',
          color: active===label ? '#fff' : 'var(--muted)', transition:'all 0.15s',
        }}>{label}</button>
      ))}
    </div>
  )
}

function AuthScreen() {
  const [loading, setLoading] = useState(false)
  const signIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: typeof window!=='undefined' ? window.location.origin : '' } })
  }
  return (
    <div className="auth-bg" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="auth-grid" /><div className="auth-glow" />
      <div style={{ position:'relative', zIndex:10, textAlign:'center', maxWidth:'420px', padding:'24px' }}>
        <div style={{ marginBottom:'28px', display:'flex', justifyContent:'center' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'12px', background:'linear-gradient(135deg, var(--accent), var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'24px', fontFamily:'Bookman Old Style, serif', fontWeight:800, color:'#fff' }}>C</span>
          </div>
        </div>
        <h1 style={{ fontFamily:'Bookman Old Style, Libre Baskerville, serif', fontSize:'36px', fontWeight:800, color:'var(--text)', lineHeight:1.15, marginBottom:'10px' }}>
          CHiiRAG<br /><span style={{ color:'var(--accent)' }}>Stock Journal</span>
        </h1>
        <p style={{ color:'var(--muted)', fontSize:'12px', lineHeight:1.7, marginBottom:'32px' }}>
          Personal trade journal with live NSE/BSE prices,<br />MTF interest tracking, and full P&amp;L analytics.
        </p>
        <button onClick={signIn} disabled={loading} className="btn btn-primary" style={{ padding:'12px 32px', fontSize:'13px', width:'100%', justifyContent:'center' }}>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color||'var(--text)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState([])
  const [livePrices, setLivePrices] = useState({})
  const [fetchingPrice, setFetchingPrice] = useState({})
  const [filter, setFilter] = useState('ALL')
  const [accountFilter, setAccountFilter] = useState('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const isAdmin = session?.user?.email === 'gogoaheadgo@gmail.com'

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => { setSession(session); setAuthLoading(false); if(session) saveProfile(session) })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setAuthLoading(false); if(s) saveProfile(s) })
    return () => subscription.unsubscribe()

  async function saveProfile(sess) {
    if (!sess?.user) return
    await supabase.from('profiles').upsert({
      id: sess.user.id,
      email: sess.user.email,
      full_name: sess.user.user_metadata?.full_name || sess.user.user_metadata?.name || null,
      avatar_url: sess.user.user_metadata?.avatar_url || null,
    }, { onConflict: 'id' })
  }
  }, [])

  const loadTrades = useCallback(async () => {
    if (!session) return
    setTradesLoading(true)
    const { data } = await supabase.from('trades').select('*').eq('user_id', session.user.id).order('created_at', { ascending:false })
    if (data) setTrades(data)
    setTradesLoading(false)
  }, [session])

  useEffect(() => { loadTrades() }, [loadTrades])
  useEffect(() => { setAccounts([...new Set(trades.map(t => t.account).filter(Boolean))]) }, [trades])

  const fetchPrice = useCallback(async (symbol) => {
    if (livePrices[symbol]!==undefined || fetchingPrice[symbol]) return
    setFetchingPrice(p => ({ ...p, [symbol]:true }))
    try {
      const res = await fetch(`/api/stock/${symbol}`)
      const data = await res.json()
      if (data.price) setLivePrices(p => ({ ...p, [symbol]:data }))
    } catch {}
    setFetchingPrice(p => ({ ...p, [symbol]:false }))
  }, [livePrices, fetchingPrice])

  useEffect(() => { trades.filter(t => t.status==='OPEN').forEach(t => fetchPrice(t.ticker)) }, [trades]) // eslint-disable-line

  const handleAdd = async (data) => {
    const { error } = await supabase.from('trades').insert([{ ...data, user_id:session.user.id }])
    if (error) throw new Error(error.message)
    await loadTrades()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade permanently?')) return
    await supabase.from('trades').delete().eq('id', id)
    await loadTrades()
  }

  const signOut = () => supabase.auth.signOut()

  const filtered = trades.filter(t => {
    const statusOk = filter==='ALL' || t.status===filter
    const accountOk = accountFilter==='ALL' || t.account===accountFilter
    return statusOk && accountOk
  })

  const openTrades = trades.filter(t => t.status==='OPEN')
  const closedTrades = trades.filter(t => t.status==='CLOSED')
  const totalRealised = closedTrades.reduce((s,t) => s+(t.realized_gains||0), 0)
  const totalUnrealised = openTrades.reduce((s,t) => {
    const lp = livePrices[t.ticker]; if (!lp) return s
    return s + (t.direction==='LONG' ? (lp.price-t.entry_price)*t.quantity : (t.entry_price-lp.price)*t.quantity)
  }, 0)
  const wins = closedTrades.filter(t => (t.realized_gains||0)>0)
  const winRate = closedTrades.length>0 ? (wins.length/closedTrades.length)*100 : null
  const fmt = (n) => Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits:0 })

  if (authLoading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}><div style={{ color:'var(--muted)' }}>Loading...</div></div>
  if (!session) return <AuthScreen />

  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>CHiiRAG Stock Journal</title></Head>
      <header className="header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div className="india-flag-logo-sm" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, background:'#FF9933' }} />
            <div style={{ flex:1, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', border:'1.5px solid #000080' }} />
            </div>
            <div style={{ flex:1, background:'#138808' }} />
          </div>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span></div>
        </div>
        <NavPill active="Main Page" isAdmin={isAdmin} />
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ padding:'6px 14px', fontSize:'11px' }}>+ New Trade</button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 12px', fontSize:'11px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
          <StatCard label="Realised P&L" value={`${totalRealised>=0?'+':'−'}Rs${fmt(totalRealised)}`} color={totalRealised>=0?'var(--bull)':'var(--bear)'} />
          <StatCard label="Unrealised P&L" value={`${totalUnrealised>=0?'+':'−'}Rs${fmt(totalUnrealised)}`} color={totalUnrealised>=0?'var(--bull)':'var(--bear)'} />
          <StatCard label="Open Trades" value={openTrades.length} />
          <StatCard label="Win Rate" value={winRate!==null ? `${winRate.toFixed(1)}%` : '—'} color="var(--accent)" sub={`${wins.length}W · ${closedTrades.length-wins.length}L`} />
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
          {['ALL','OPEN','CLOSED'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'5px 12px', borderRadius:'4px', border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`,
              background: filter===f?'var(--accent-dim)':'transparent', color:filter===f?'var(--accent)':'var(--muted)',
              cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600,
            }}>{f}</button>
          ))}
          <div style={{ width:'1px', background:'var(--border)', margin:'0 4px' }} />
          {['ALL',...accounts].map(a => (
            <button key={a} onClick={() => setAccountFilter(a)} style={{
              padding:'5px 12px', borderRadius:'4px', border:`1px solid ${accountFilter===a?'var(--accent2)':'var(--border)'}`,
              background: accountFilter===a?'rgba(2,132,199,0.1)':'transparent', color:accountFilter===a?'var(--accent2)':'var(--muted)',
              cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace', fontWeight:600,
            }}>{a}</button>
          ))}
        </div>

        {/* Table */}
        {tradesLoading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'var(--muted)' }}>Loading trades...</div>
        ) : filtered.length===0 ? (
          <div className="empty-state">
            <div className="empty-title">No trades yet</div>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Add First Trade</button>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Direction</th>
                  <th>Entry Date</th>
                  <th className="right">Entry Rs</th>
                  <th className="right">CMP</th>
                  <th className="right">Exit Rs</th>
                  <th className="right">Qty</th>
                  <th className="right">Investment</th>
                  <th className="right">Actual Inv</th>
                  <th className="right">MTF Interest</th>
                  <th className="right">Unrealised P&L</th>
                  <th className="right">Realised P&L</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(trade => {
                  const isOpen = trade.status==='OPEN'
                  const lp = livePrices[trade.ticker]
                  const unrealised = isOpen && lp ? (trade.direction==='LONG' ? (lp.price-trade.entry_price)*trade.quantity : (trade.entry_price-lp.price)*trade.quantity) : null
                  const days = Math.max(0, differenceInDays(trade.exit_date ? new Date(trade.exit_date) : new Date(), new Date(trade.entry_date)))
                  const mtfBase = trade.invested_capital && trade.actual_investment ? trade.invested_capital - trade.actual_investment : null
                  const mtfDays = trade.status==='CLOSED'&&trade.exit_date ? Math.max(1,differenceInDays(new Date(trade.exit_date),new Date(trade.entry_date))) : days
                  const mtfInterest = mtfBase && mtfBase>0 && trade.mtf_interest_rate ? (mtfBase*trade.mtf_interest_rate*mtfDays)/36500 : null
                  return (
                    <tr key={trade.id}>
                      <td><div style={{ fontWeight:700 }}>{trade.ticker}</div><div style={{ fontSize:'9px', color:'var(--muted)' }}>NSE</div></td>
                      <td><span className={`badge badge-${trade.direction.toLowerCase()}`}>{trade.direction}</span></td>
                      <td style={{ color:'var(--muted)', fontSize:'11px' }}>{trade.entry_date ? format(new Date(trade.entry_date),'dd MMM yy') : '—'}</td>
                      <td className="right">Rs{trade.entry_price?.toLocaleString('en-IN')}</td>
                      <td className="right">
                        {isOpen ? fetchingPrice[trade.ticker] ? <span style={{ color:'var(--muted)' }}>...</span>
                          : lp ? <div><div style={{ fontWeight:600 }}>Rs{lp.price?.toLocaleString('en-IN')}</div><div style={{ fontSize:'10px', color:lp.change>=0?'var(--bull)':'var(--bear)' }}>{lp.change>=0?'+':''}{lp.changePercent?.toFixed(2)}%</div></div>
                          : <span style={{ color:'var(--muted)' }}>—</span>
                        : <span style={{ color:'var(--muted)' }}>—</span>}
                      </td>
                      <td className="right">{trade.exit_price ? `Rs${trade.exit_price.toLocaleString('en-IN')}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="right">{trade.quantity?.toLocaleString('en-IN')}</td>
                      <td className="right">{trade.invested_capital ? `Rs${trade.invested_capital.toLocaleString('en-IN',{maximumFractionDigits:0})}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="right">{trade.actual_investment ? `Rs${trade.actual_investment.toLocaleString('en-IN',{maximumFractionDigits:0})}` : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="right">{mtfInterest!=null ? <span style={{ color:'var(--gold)' }}>Rs{mtfInterest.toLocaleString('en-IN',{maximumFractionDigits:0})}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="right">{unrealised!==null ? <span style={{ color:unrealised>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{unrealised>=0?'+':'−'}Rs{fmt(unrealised)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                      <td className="right">{trade.realized_gains!=null ? <span style={{ color:trade.realized_gains>=0?'var(--bull)':'var(--bear)', fontWeight:600 }}>{trade.realized_gains>=0?'+':'−'}Rs{fmt(trade.realized_gains)}</span> : <span style={{ color:'var(--muted)' }}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showAdd && <AddTradeModal session={session} onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </>
  )
}
