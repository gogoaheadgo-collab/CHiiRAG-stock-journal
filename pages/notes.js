import React, { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label:'Dashboard', path:'/dashboard' },
    { label:'Accounts', path:'/accounts' },
    ...(isAdmin ? [
      { label:'Subscribers', path:'/subscribers' },
      { label:'All Trades', path:'/all-trades' },
    ] : []),
    { label:'Revenue Sharing', path:'/revenue-sharing' },
    { label:'Alerts', path:'/alerts' },
    { label:'Notes', path:'/notes' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px', flexWrap:'wrap' }}>
      {items.map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 16px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600,
          background:active===label?'var(--accent)':'transparent',
          color:active===label?'#fff':'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}

function MiniCalendar({ selected, onSelect, dotDates }) {
  const today = new Date()
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const yr = view.getFullYear(), mo = view.getMonth()
  const firstDay = new Date(yr, mo, 1).getDay()
  const days = new Date(yr, mo+1, 0).getDate()
  const pad = firstDay === 0 ? 6 : firstDay - 1
  const cells = [...Array(pad).fill(null), ...Array.from({length:days},(_,i)=>i+1)]
  const toStr = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate())
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', overflow:'hidden', width:'220px', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => setView(new Date(yr, mo-1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'12px' }}>‹</button>
        <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color:'var(--text)' }}>{MONTHS[mo]} {yr}</span>
        <button onClick={() => setView(new Date(yr, mo+1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'12px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'6px 4px 2px' }}>
        {['M','T','W','T','F','S','S'].map((d,i) => (
          <div key={i} style={{ textAlign:'center', fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600, padding:'2px 0' }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const s = toStr(yr, mo, d)
          const isTod = s === todayStr
          const isSel = s === selected
          const hasDot = dotDates.has(s)
          return (
            <div key={i} onClick={() => onSelect(s)}
              style={{ textAlign:'center', padding:'4px 2px', cursor:'pointer', borderRadius:'5px', margin:'1px',
                background: isSel ? 'var(--accent)' : isTod ? 'var(--accent-dim)' : 'transparent' }}
              onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='rgba(14,165,233,0.1)' }}
              onMouseLeave={e => { if(!isSel) e.currentTarget.style.background=isTod?'var(--accent-dim)':'transparent' }}>
              <div style={{ fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:isSel||isTod?700:400,
                color:isSel?'#fff':isTod?'var(--accent)':'var(--text)' }}>{d}</div>
              {hasDot && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:isSel?'#fff':'var(--accent)', margin:'0 auto' }} />}
            </div>
          )
        })}
      </div>
      <div style={{ padding:'8px', borderTop:'1px solid var(--border)' }}>
        <button onClick={() => onSelect(todayStr)} style={{ width:'100%', padding:'5px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>Today</button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const today = new Date().toISOString().slice(0,10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [allNotes, setAllNotes] = useState([])
  const [content, setContent] = useState('')
  const [tickers, setTickers] = useState([])
  const [imageUrls, setImageUrls] = useState([])
  const [tickerInput, setTickerInput] = useState('')
  const [tickerSuggestions, setTickerSuggestions] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [stockCards, setStockCards] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const fileRef = useRef(null)
  const loadingRef = useRef(false)

  const getToken = useCallback(async () =>
    (await supabase.auth.getSession()).data.session?.access_token, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session:s } }) => {
      if (!s) { router.push('/'); return }
      setSession(s); setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => { if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // Load all notes (for calendar dots + sidebar)
  const loadAll = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/notes', { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setAllNotes(data)
  }, [getToken])

  useEffect(() => { if (session) loadAll() }, [session, loadAll])

  // Load note for selected date
  const loadNote = useCallback(async (date) => {
    if (loadingRef.current) return
    loadingRef.current = true
    const token = await getToken()
    if (!token) { loadingRef.current = false; return }
    const res = await fetch(`/api/notes?date=${date}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    const note = Array.isArray(data) && data.length > 0 ? data[0] : null
    setContent(note?.content || '')
    setTickers(note?.tickers || [])
    setImageUrls(note?.image_urls || [])
    setStockCards({})
    setSaveMsg('')
    loadingRef.current = false
  }, [getToken])

  useEffect(() => { if (session && selectedDate) loadNote(selectedDate) }, [session, selectedDate]) // eslint-disable-line

  // Fetch stock price for a ticker
  const fetchStock = async (sym) => {
    try {
      const res = await fetch(`/api/stock/${sym}`)
      const d = await res.json()
      if (d.price) setStockCards(prev => ({ ...prev, [sym]: d }))
    } catch {}
  }

  useEffect(() => {
    tickers.forEach(sym => { if (!stockCards[sym]) fetchStock(sym) })
  }, [tickers]) // eslint-disable-line

  // Ticker autocomplete
  const searchTicker = async (q) => {
    setTickerInput(q.toUpperCase())
    if (q.length < 2) { setTickerSuggestions([]); setShowDrop(false); return }
    try {
      const r = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      setTickerSuggestions(Array.isArray(d) ? d : [])
      setShowDrop(true)
    } catch {}
  }

  const addTicker = (sym) => {
    if (!tickers.includes(sym)) setTickers(prev => [...prev, sym])
    setTickerInput(''); setTickerSuggestions([]); setShowDrop(false)
    fetchStock(sym)
  }

  const removeTicker = (sym) => {
    setTickers(prev => prev.filter(t => t !== sym))
    setStockCards(prev => { const n = {...prev}; delete n[sym]; return n })
  }

  // Save
  const handleSave = async () => {
    const token = await getToken()
    if (!token) { setSaveMsg('Not logged in'); return }
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ note_date: selectedDate, content, tickers, image_urls: imageUrls }),
      })
      const data = await res.json()
      if (data.error) { setSaveMsg('Error: ' + data.error) }
      else { setSaveMsg('✓ Saved!'); loadAll() }
    } catch (e) { setSaveMsg('Error: ' + e.message) }
    setSaving(false)
  }

  // Image upload — base64 approach (no formidable needed)
  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    const token = await getToken()
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1]
      const ext = file.name.split('.').pop()
      try {
        const { data, error } = await supabase.storage.from('note-images')
          .upload(`${Date.now()}.${ext}`, decode(base64), { contentType: file.type, upsert: false })
        if (!error) {
          const { data:{ publicUrl } } = supabase.storage.from('note-images').getPublicUrl(data.path)
          setImageUrls(prev => [...prev, publicUrl])
        }
      } catch {}
      setImgUploading(false)
    }
    reader.readAsDataURL(file)
  }

  // Simple base64 decode for storage upload
  function decode(base64) {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  const removeImage = (url) => setImageUrls(prev => prev.filter(u => u !== url))

  // Search
  const doSearch = async () => {
    if (!searchQ.trim()) { setSearchResults([]); return }
    setSearching(true)
    const token = await getToken()
    const res = await fetch(`/api/notes?search=${encodeURIComponent(searchQ)}`, { headers:{ Authorization:`Bearer ${token}` } })
    const data = await res.json()
    setSearchResults(Array.isArray(data) ? data : [])
    setSearching(false)
  }

  const dotDates = new Set(allNotes.map(n => n.note_date))
  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  })

  if (!session) return null

  return (
    <>
      <Head>
        <title>Notes — CHiiRAG Stock Journal</title>
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div className="tricolor-bar" />
      <header className="header" style={{ top:'4px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div className="india-flag-logo-sm" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, background:'#FF9933' }} />
            <div style={{ flex:1, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', border:'1.5px solid #000080' }} />
            </div>
            <div style={{ flex:1, background:'#138808' }} />
          </div>
          <div style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>
            CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span>
          </div>
        </div>
        <NavPill active="Notes" isAdmin={isAdmin} />
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href='/' }}
          className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'80px 16px 40px' }}>

        {/* Header + search */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <h1 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:0 }}>📓 Trading Notes</h1>
            <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:'4px', fontFamily:'DM Mono, monospace' }}>Daily journal · press Save to store your notes</p>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key==='Enter' && doSearch()}
              placeholder="🔍 Search notes..." style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 12px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', width:'200px', outline:'none' }} />
            <button onClick={doSearch} disabled={searching} style={{ padding:'8px 14px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>
              {searching ? '...' : 'Search'}
            </button>
            {searchResults.length > 0 && (
              <button onClick={() => { setSearchResults([]); setSearchQ('') }} style={{ padding:'8px 10px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✕</button>
            )}
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom:'20px', background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color:'var(--accent)', marginBottom:'10px' }}>
              {searchResults.length} result{searchResults.length > 1 ? 's' : ''} for "{searchQ}"
            </div>
            {searchResults.map(n => (
              <div key={n.id} onClick={() => { setSelectedDate(n.note_date); setSearchResults([]); setSearchQ('') }}
                style={{ padding:'10px 12px', marginBottom:'6px', background:'var(--bg)', borderRadius:'6px', border:'1px solid var(--border)', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ fontFamily:'DM Mono, monospace', fontSize:'11px', color:'var(--accent)', fontWeight:700, marginBottom:'3px' }}>
                  {new Date(n.note_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                  {n.tickers?.length > 0 && <span style={{ marginLeft:'8px', color:'var(--gold)' }}>📈 {n.tickers.join(', ')}</span>}
                </div>
                <div style={{ fontSize:'13px', color:'var(--muted)', fontFamily:'Caveat, cursive', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                  {n.content?.slice(0,120) || '(empty)'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main layout */}
        <div style={{ display:'flex', gap:'20px', alignItems:'flex-start' }}>

          {/* Sidebar: calendar + recent */}
          <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:'12px' }}>
            <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} dotDates={dotDates} />
            {allNotes.length > 0 && (
              <div style={{ width:'220px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px' }}>
                <div style={{ fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', marginBottom:'8px' }}>RECENT NOTES</div>
                {allNotes.slice(0,8).map(n => (
                  <div key={n.id} onClick={() => setSelectedDate(n.note_date)}
                    style={{ padding:'6px 8px', cursor:'pointer', borderRadius:'5px', marginBottom:'3px',
                      background:n.note_date===selectedDate?'var(--accent-dim)':'transparent',
                      border:n.note_date===selectedDate?'1px solid var(--accent)':'1px solid transparent' }}
                    onMouseEnter={e => { if(n.note_date!==selectedDate) e.currentTarget.style.background='rgba(14,165,233,0.05)' }}
                    onMouseLeave={e => { if(n.note_date!==selectedDate) e.currentTarget.style.background='transparent' }}>
                    <div style={{ fontFamily:'DM Mono, monospace', fontSize:'10px', color:n.note_date===selectedDate?'var(--accent)':'var(--muted)', fontWeight:700 }}>
                      {new Date(n.note_date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                      {n.tickers?.length>0 && <span style={{ marginLeft:'6px', color:'var(--gold)', fontSize:'9px' }}>{n.tickers[0]}</span>}
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'Caveat, cursive', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'180px' }}>
                      {n.content?.slice(0,35) || '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note paper */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* Toolbar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:'12px', color:'var(--muted)' }}>{displayDate}</div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                {/* Ticker search */}
                <div style={{ position:'relative' }}>
                  <input value={tickerInput} onChange={e => searchTicker(e.target.value)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                    onKeyDown={e => { if(e.key==='Enter' && tickerInput.trim()) addTicker(tickerInput.trim()) }}
                    placeholder="📈 Add ticker..."
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'6px 12px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', width:'160px', outline:'none', textTransform:'uppercase' }} />
                  {showDrop && tickerSuggestions.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 20px rgba(0,0,0,0.25)', maxHeight:'180px', overflowY:'auto', marginTop:'2px' }}>
                      {tickerSuggestions.map((item,i) => (
                        <div key={i} onMouseDown={() => addTicker(item.ticker)}
                          style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div>
                            <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', color:'var(--accent)' }}>{item.ticker}</div>
                            <div style={{ fontSize:'10px', color:'var(--muted)' }}>{item.shortName}</div>
                          </div>
                          <span style={{ fontSize:'9px', color:'var(--muted)', background:'var(--surface)', padding:'1px 5px', borderRadius:'3px', alignSelf:'center' }}>{item.exchange}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Photo upload */}
                <button onClick={() => fileRef.current?.click()} disabled={imgUploading}
                  style={{ padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>
                  {imgUploading ? '⏳...' : '📷 Photo'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display:'none' }} />
                {/* SAVE BUTTON */}
                <button onClick={handleSave} disabled={saving}
                  style={{ padding:'8px 20px', background:saveMsg.startsWith('✓')?'var(--bull)':'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700, minWidth:'110px', transition:'background 0.3s', opacity:saving?0.7:1 }}>
                  {saving ? '⏳ Saving...' : saveMsg.startsWith('✓') ? '✓ Saved!' : '💾 Save Note'}
                </button>
              </div>
            </div>

            {saveMsg && !saveMsg.startsWith('✓') && (
              <div style={{ marginBottom:'8px', color:'var(--bear)', fontSize:'12px', fontFamily:'DM Mono, monospace' }}>{saveMsg}</div>
            )}

            {/* Ticker chips + stock cards */}
            {tickers.length > 0 && (
              <div style={{ marginBottom:'10px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-start' }}>
                {tickers.map(sym => {
                  const sd = stockCards[sym]
                  const isUp = sd ? sd.change >= 0 : true
                  return (
                    <div key={sym} style={{ display:'flex', alignItems:'center', gap:'10px', background:isUp?'rgba(0,230,118,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${isUp?'rgba(0,230,118,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:'8px', padding:'7px 12px' }}>
                      <div>
                        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{sym}</div>
                        {sd && <div style={{ fontSize:'10px', color:'var(--muted)' }}>{sd.shortName||''}</div>}
                      </div>
                      {sd && (
                        <div>
                          <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'14px', color:isUp?'var(--bull)':'var(--bear)' }}>
                            Rs{Number(sd.price).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                          </div>
                          <div style={{ fontSize:'10px', color:isUp?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>
                            {isUp?'+':''}{Number(sd.changePercent||0).toFixed(2)}%
                          </div>
                        </div>
                      )}
                      <button onClick={() => removeTicker(sym)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'14px', padding:'0 2px', lineHeight:1 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* THE PAPER */}
            <div style={{
              position:'relative', background:'#fefef8', borderRadius:'4px',
              boxShadow:'0 2px 12px rgba(0,0,0,0.18), 3px 5px 20px rgba(0,0,0,0.1)',
              minHeight:'580px', overflow:'hidden', border:'1px solid #e8e0c8',
            }}>
              {/* Red margin */}
              <div style={{ position:'absolute', left:'58px', top:0, bottom:0, width:'1px', background:'rgba(220,60,60,0.3)', zIndex:1, pointerEvents:'none' }} />
              {/* Holes */}
              {[60, '50%', 'calc(100% - 60px)'].map((top, i) => (
                <div key={i} style={{ position:'absolute', left:'20px', top, transform:typeof top==='string'?'translateY(-50%)':'none', width:'14px', height:'14px', borderRadius:'50%', background:'#f0ebe0', border:'1px solid #d4cbb8', zIndex:2, pointerEvents:'none' }} />
              ))}
              {/* Lines */}
              {Array.from({length:32}).map((_,i) => (
                <div key={i} style={{ position:'absolute', left:0, right:0, top:`${i*36+72}px`, height:'1px', background:'rgba(100,149,237,0.18)', zIndex:0, pointerEvents:'none' }} />
              ))}
              {/* Date header */}
              <div style={{ paddingTop:'16px', paddingLeft:'72px', paddingRight:'20px', paddingBottom:'10px', borderBottom:'2px solid rgba(173,140,100,0.25)', position:'relative', zIndex:1 }}>
                <div style={{ fontFamily:'Caveat, cursive', fontSize:'22px', color:'#5a4a3a', fontWeight:600 }}>{displayDate}</div>
              </div>
              {/* Textarea */}
              <textarea value={content} onChange={e => { setContent(e.target.value); setSaveMsg('') }}
                placeholder="Write your trading thoughts, analysis, trade ideas..."
                style={{
                  position:'relative', zIndex:1, display:'block',
                  width:'100%', minHeight:'510px', background:'transparent',
                  border:'none', outline:'none', resize:'none',
                  fontFamily:'Caveat, cursive', fontSize:'21px',
                  color:'#2c1810', lineHeight:'36px',
                  padding:'8px 24px 16px 72px', boxSizing:'border-box',
                }}
              />
            </div>

            {/* Images */}
            {imageUrls.length > 0 && (
              <div style={{ marginTop:'14px' }}>
                <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'8px', letterSpacing:'0.1em' }}>ATTACHED PHOTOS</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {imageUrls.map((url,i) => (
                    <div key={i} style={{ position:'relative', border:'2px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
                      <img src={url} alt="" style={{ width:'140px', height:'100px', objectFit:'cover', display:'block' }} />
                      <button onClick={() => removeImage(url)} style={{ position:'absolute', top:'4px', right:'4px', background:'rgba(0,0,0,0.65)', color:'#fff', border:'none', borderRadius:'50%', width:'20px', height:'20px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
