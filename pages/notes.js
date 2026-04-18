import React, { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import NavPill from '../components/NavPill'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

// Mini calendar
function NoteCalendar({ selectedDate, onSelect, noteDates }) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = month.getFullYear(), mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const pad = firstDay === 0 ? 6 : firstDay - 1
  const cells = [...Array(pad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const fmt = (y, m, d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', overflow:'hidden', width:'220px', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
        <button onClick={() => setMonth(new Date(year, mon-1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'12px' }}>\u2039</button>
        <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color:'var(--text)' }}>
          {month.toLocaleString('default', { month:'long' })} {year}
        </span>
        <button onClick={() => setMonth(new Date(year, mon+1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'12px' }}>\u203a</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'4px' }}>
        {['M','T','W','T','F','S','S'].map((d,i) => (
          <div key={i} style={{ textAlign:'center', padding:'4px 0', fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const dateStr = fmt(year, mon, d)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasNote = noteDates.has(dateStr)
          return (
            <div key={i} onClick={() => onSelect(dateStr)}
              style={{
                textAlign:'center', padding:'5px 2px', cursor:'pointer', borderRadius:'5px', position:'relative',
                background: isSelected ? 'var(--accent)' : isToday ? 'var(--accent-dim)' : 'transparent',
                margin:'1px',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'var(--accent-dim)' : 'transparent' }}>
              <span style={{ fontSize:'11px', fontFamily:'DM Mono, monospace', color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text)', fontWeight: isToday||isSelected ? 700 : 400 }}>{d}</span>
              {hasNote && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background: isSelected ? '#fff' : 'var(--accent)', margin:'1px auto 0' }} />}
            </div>
          )
        })}
      </div>
      <div style={{ padding:'8px', borderTop:'1px solid var(--border)' }}>
        <button onClick={() => onSelect(todayStr)} style={{ width:'100%', padding:'5px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>
          Today
        </button>
      </div>
    </div>
  )
}

// Stock info card
function StockCard({ data }) {
  if (!data) return null
  const change = data.change || 0
  const isUp = change >= 0
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:'12px', background: isUp ? 'rgba(0,230,118,0.06)' : 'rgba(239,68,68,0.06)', border:`1px solid ${isUp?'rgba(0,230,118,0.2)':'rgba(239,68,68,0.2)'}`, borderRadius:'8px', padding:'8px 14px', marginBottom:'12px' }}>
      <div>
        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'14px', color:'var(--text)' }}>{data.ticker}</div>
        <div style={{ fontSize:'10px', color:'var(--muted)', marginTop:'1px' }}>{data.shortName || ''}</div>
      </div>
      <div>
        <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'16px', color: isUp ? 'var(--bull)' : 'var(--bear)' }}>
          Rs{Number(data.price||0).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 })}
        </div>
        <div style={{ fontSize:'11px', color: isUp ? 'var(--bull)' : 'var(--bear)', fontFamily:'DM Mono, monospace' }}>
          {isUp?'+':''}{Number(data.changePercent||0).toFixed(2)}% today
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [notes, setNotes] = useState([]) // all notes for calendar dots
  const [currentNote, setCurrentNote] = useState(null)
  const [content, setContent] = useState('')
  const [ticker, setTicker] = useState('')
  const [stockData, setStockData] = useState(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [imageUrls, setImageUrls] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [tickerSuggestions, setTickerSuggestions] = useState([])
  const [showTickerDrop, setShowTickerDrop] = useState(false)
  const fileInputRef = useRef(null)
  const saveTimerRef = useRef(null)

  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.push('/'); return }
      setSession(s); setIsAdmin(s.user.email === ADMIN_EMAIL)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => { if (!s) router.push('/') })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // Load all note dates for calendar dots
  const loadAllNotes = useCallback(async () => {
    const token = await getToken()
    const res = await fetch('/api/notes', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (Array.isArray(data)) setNotes(data)
  }, [getToken])

  useEffect(() => { if (session) loadAllNotes() }, [session, loadAllNotes])

  // Load note for selected date
  const loadDateNote = useCallback(async (date) => {
    const token = await getToken()
    const res = await fetch(`/api/notes?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    const note = Array.isArray(data) && data.length > 0 ? data[0] : null
    setCurrentNote(note)
    setContent(note?.content || '')
    setTicker(note?.stock_ticker || '')
    setStockData(note?.stock_data || null)
    setImageUrls(note?.image_urls || [])
  }, [getToken])

  useEffect(() => { if (session && selectedDate) loadDateNote(selectedDate) }, [session, selectedDate, loadDateNote])

  // Auto-save with debounce
  const autoSave = useCallback(async (newContent, newTicker, newStockData, newImageUrls) => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const token = await getToken()
      setSaving(true)
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note_date: selectedDate, content: newContent, stock_ticker: newTicker || null, stock_data: newStockData || null, image_urls: newImageUrls }),
      })
      setSaving(false); setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      loadAllNotes()
    }, 800)
  }, [getToken, selectedDate, loadAllNotes])

  const handleContentChange = (val) => {
    setContent(val)
    autoSave(val, ticker, stockData, imageUrls)
  }

  // Ticker search
  const searchTicker = async (q) => {
    setTicker(q.toUpperCase())
    if (q.length < 2) { setTickerSuggestions([]); setShowTickerDrop(false); return }
    try {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setTickerSuggestions(Array.isArray(data) ? data : [])
      setShowTickerDrop(true)
    } catch {}
  }

  const fetchStockData = async (sym) => {
    setStockLoading(true)
    setShowTickerDrop(false)
    setTicker(sym)
    setTickerSuggestions([])
    try {
      const res = await fetch(`/api/stock/${sym}`)
      const data = await res.json()
      if (data.price) {
        const sd = { ticker: sym, price: data.price, change: data.change, changePercent: data.changePercent, shortName: data.shortName }
        setStockData(sd)
        autoSave(content, sym, sd, imageUrls)
      }
    } catch {}
    setStockLoading(false)
  }

  // Image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    const token = await getToken()
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await fetch('/api/upload-note-image', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: formData })
      const data = await res.json()
      if (data.url) {
        const newUrls = [...imageUrls, data.url]
        setImageUrls(newUrls)
        autoSave(content, ticker, stockData, newUrls)
      }
    } catch (e) { console.error(e) }
    setImgUploading(false)
  }

  const removeImage = (url) => {
    const newUrls = imageUrls.filter(u => u !== url)
    setImageUrls(newUrls)
    autoSave(content, ticker, stockData, newUrls)
  }

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    const token = await getToken()
    const res = await fetch(`/api/notes?search=${encodeURIComponent(searchQuery)}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setSearchResults(Array.isArray(data) ? data : [])
    setSearching(false)
  }

  const noteDates = new Set(notes.map(n => n.note_date))

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  })

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/' }

  if (!session) return null

  return (
    <>
      <Head>
        <title>Notes \u2014 CHiiRAG Stock Journal</title>
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
        <button onClick={signOut} className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:'11px' }}>Sign Out</button>
      </header>

      <main style={{ maxWidth:'1400px', margin:'0 auto', padding:'80px 16px 40px' }}>

        {/* Page header + search */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <h1 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:0 }}>\ud83d\udcd3 Trading Notes</h1>
            <p style={{ color:'var(--muted)', fontSize:'12px', marginTop:'4px', fontFamily:'DM Mono, monospace' }}>Your daily journal \u00b7 auto-saved</p>
          </div>
          {/* Search bar */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="\ud83d\udd0d Search notes e.g. PFOCUS"
                style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'8px 14px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', width:'240px', outline:'none' }}
              />
            </div>
            <button onClick={handleSearch} disabled={searching} style={{ padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>
              {searching ? '...' : 'Search'}
            </button>
            {searchResults.length > 0 && (
              <button onClick={() => { setSearchResults([]); setSearchQuery('') }} style={{ padding:'8px 12px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>\u2715 Clear</button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom:'24px', background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', color:'var(--accent)', marginBottom:'12px' }}>
              {searchResults.length} note{searchResults.length > 1 ? 's' : ''} found for "{searchQuery}"
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {searchResults.map(note => (
                <div key={note.id} onClick={() => { setSelectedDate(note.note_date); setSearchResults([]); setSearchQuery('') }}
                  style={{ cursor:'pointer', padding:'12px 14px', background:'var(--bg)', borderRadius:'8px', border:'1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                  <div style={{ fontFamily:'DM Mono, monospace', fontSize:'11px', color:'var(--accent)', marginBottom:'4px', fontWeight:700 }}>
                    {new Date(note.note_date+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                    {note.stock_ticker && <span style={{ marginLeft:'10px', color:'var(--gold)' }}>\ud83d\udcc8 {note.stock_ticker}</span>}
                  </div>
                  <div style={{ fontSize:'13px', color:'var(--muted)', fontFamily:'Caveat, cursive', lineHeight:1.5,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {note.content?.slice(0, 150) || '(empty)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main layout: calendar + note paper */}
        <div style={{ display:'flex', gap:'20px', alignItems:'flex-start' }}>

          {/* Calendar sidebar */}
          <div style={{ flexShrink:0 }}>
            <NoteCalendar selectedDate={selectedDate} onSelect={setSelectedDate} noteDates={noteDates} />
            {/* Notes list below calendar */}
            {notes.length > 0 && (
              <div style={{ marginTop:'12px', width:'220px' }}>
                <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'6px', letterSpacing:'0.1em' }}>RECENT NOTES</div>
                {notes.slice(0, 8).map(n => (
                  <div key={n.id} onClick={() => setSelectedDate(n.note_date)}
                    style={{ padding:'6px 10px', cursor:'pointer', borderRadius:'6px', marginBottom:'3px', background: n.note_date === selectedDate ? 'var(--accent-dim)' : 'transparent', border: n.note_date === selectedDate ? '1px solid var(--accent)' : '1px solid transparent' }}
                    onMouseEnter={e => { if (n.note_date !== selectedDate) e.currentTarget.style.background = 'var(--surface)' }}
                    onMouseLeave={e => { if (n.note_date !== selectedDate) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ fontFamily:'DM Mono, monospace', fontSize:'10px', color: n.note_date === selectedDate ? 'var(--accent)' : 'var(--muted)', fontWeight:700 }}>
                      {new Date(n.note_date+'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                      {n.stock_ticker && <span style={{ marginLeft:'6px', color:'var(--gold)', fontSize:'9px' }}>{n.stock_ticker}</span>}
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'Caveat, cursive', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'180px' }}>
                      {n.content?.slice(0,40) || '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note paper */}
          <div style={{ flex:1, minWidth:0 }}>
            {/* Paper toolbar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
              <div style={{ fontFamily:'DM Mono, monospace', fontSize:'12px', color:'var(--muted)' }}>
                {displayDate}
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {/* Ticker input */}
                <div style={{ position:'relative' }}>
                  <input
                    value={ticker}
                    onChange={e => searchTicker(e.target.value)}
                    onBlur={() => setTimeout(() => setShowTickerDrop(false), 200)}
                    placeholder="\ud83d\udcc8 Add stock ticker..."
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'6px 12px', color:'var(--text)', fontSize:'12px', fontFamily:'DM Mono, monospace', width:'180px', outline:'none', textTransform:'uppercase' }}
                  />
                  {showTickerDrop && tickerSuggestions.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 20px rgba(0,0,0,0.2)', maxHeight:'200px', overflowY:'auto', marginTop:'2px' }}>
                      {tickerSuggestions.map((item, i) => (
                        <div key={i} onMouseDown={() => fetchStockData(item.ticker)}
                          style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div>
                            <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', color:'var(--accent)' }}>{item.ticker}</div>
                            <div style={{ fontSize:'10px', color:'var(--muted)' }}>{item.shortName}</div>
                          </div>
                          <div style={{ fontSize:'9px', color:'var(--muted)', background:'var(--surface)', padding:'1px 5px', borderRadius:'3px' }}>{item.exchange}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {ticker && (
                  <button onClick={() => fetchStockData(ticker)} disabled={stockLoading} style={{ padding:'6px 12px', background:'var(--accent-dim)', border:'1px solid var(--accent)', color:'var(--accent)', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>
                    {stockLoading ? '...' : '\u2193 Fetch'}
                  </button>
                )}
                {ticker && (
                  <button onClick={() => { setTicker(''); setStockData(null); autoSave(content, '', null, imageUrls) }}
                    style={{ padding:'6px 8px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>\u2715</button>
                )}
                {/* Image upload */}
                <button onClick={() => fileInputRef.current?.click()} disabled={imgUploading}
                  style={{ padding:'6px 12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>
                  {imgUploading ? '\u23f3 Uploading...' : '\ud83d\udcf7 Add Photo'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:'none' }} />
                {/* Save indicator */}
                <span style={{ fontSize:'10px', fontFamily:'DM Mono, monospace', color: saved ? 'var(--bull)' : saving ? 'var(--gold)' : 'transparent' }}>
                  {saved ? '\u2713 Saved' : saving ? 'Saving...' : '\u00b7'}
                </span>
              </div>
            </div>

            {/* Stock data card */}
            {stockData && <StockCard data={stockData} />}

            {/* THE PAPER */}
            <div style={{
              position:'relative',
              background:'#fefef8',
              borderRadius:'4px',
              boxShadow:'0 2px 8px rgba(0,0,0,0.15), 2px 4px 16px rgba(0,0,0,0.1)',
              minHeight:'600px',
              overflow:'hidden',
              border:'1px solid #e8e0c8',
            }}>
              {/* Red margin line */}
              <div style={{ position:'absolute', left:'56px', top:0, bottom:0, width:'1px', background:'rgba(220,60,60,0.3)', zIndex:1 }} />
              {/* Hole punches */}
              <div style={{ position:'absolute', left:'20px', top:'60px', width:'14px', height:'14px', borderRadius:'50%', background:'#f0ebe0', border:'1px solid #d4cbb8', zIndex:2 }} />
              <div style={{ position:'absolute', left:'20px', top:'50%', width:'14px', height:'14px', borderRadius:'50%', background:'#f0ebe0', border:'1px solid #d4cbb8', zIndex:2 }} />
              <div style={{ position:'absolute', left:'20px', bottom:'60px', width:'14px', height:'14px', borderRadius:'50%', background:'#f0ebe0', border:'1px solid #d4cbb8', zIndex:2 }} />

              {/* Date header on paper */}
              <div style={{ paddingTop:'20px', paddingLeft:'72px', paddingRight:'20px', paddingBottom:'8px', borderBottom:'2px solid rgba(173,140,100,0.3)' }}>
                <div style={{ fontFamily:'Caveat, cursive', fontSize:'20px', color:'#5a4a3a', fontWeight:600 }}>{displayDate}</div>
              </div>

              {/* Lined textarea */}
              <div style={{ position:'relative', paddingLeft:'72px', paddingRight:'24px' }}>
                {/* Horizontal lines */}
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} style={{ position:'absolute', left:0, right:0, top: `${i * 36 + 8}px`, height:'1px', background:'rgba(100,149,237,0.2)', zIndex:0 }} />
                ))}
                <textarea
                  value={content}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Write your trading thoughts, analysis, observations..."
                  style={{
                    position:'relative', zIndex:1,
                    width:'100%', minHeight:'540px', background:'transparent',
                    border:'none', outline:'none', resize:'none',
                    fontFamily:'Caveat, cursive', fontSize:'20px',
                    color:'#2c1810', lineHeight:'36px', paddingTop:'8px',
                    boxSizing:'border-box',
                  }}
                />
              </div>
            </div>

            {/* Images */}
            {imageUrls.length > 0 && (
              <div style={{ marginTop:'16px' }}>
                <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'8px' }}>ATTACHED PHOTOS</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {imageUrls.map((url, i) => (
                    <div key={i} style={{ position:'relative', border:'2px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
                      <img src={url} alt={`note-img-${i}`} style={{ width:'140px', height:'100px', objectFit:'cover', display:'block' }} />
                      <button onClick={() => removeImage(url)}
                        style={{ position:'absolute', top:'4px', right:'4px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:'20px', height:'20px', cursor:'pointer', fontSize:'11px', display:'flex', alignItems:'center', justifyContent:'center' }}>\u2715</button>
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
