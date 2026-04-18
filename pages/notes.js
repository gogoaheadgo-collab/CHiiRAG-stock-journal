import React, { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import NavPill from '../components/NavPill'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

function MiniCalendar({ selected, onSelect, dotDates }) {
  const [calView, setCalView] = useState(() => {
    const calInit = new Date()
    return new Date(calInit.getFullYear(), calInit.getMonth(), 1)
  })
  const calNow = new Date()
  const calYr = calView.getFullYear()
  const calMo = calView.getMonth()
  const calTodayStr = calNow.getFullYear() + '-' + String(calNow.getMonth()+1).padStart(2,'0') + '-' + String(calNow.getDate()).padStart(2,'0')
  const calDays = new Date(calYr, calMo+1, 0).getDate()
  const calStartDay = new Date(calYr, calMo, 1).getDay()
  const calPad = calStartDay === 0 ? 6 : calStartDay - 1
  const calGrid = [...Array(calPad).fill(null), ...Array.from({length:calDays},(_,idx)=>idx+1)]
  const CAL_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const makeDateStr = (y, m, day) => y + '-' + String(m+1).padStart(2,'0') + '-' + String(day).padStart(2,'0')

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', overflow:'hidden', width:'220px', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => setCalView(new Date(calYr, calMo-1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 10px', cursor:'pointer', fontSize:'14px' }}>‹</button>
        <span style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'11px', color:'var(--text)' }}>{CAL_NAMES[calMo]} {calYr}</span>
        <button onClick={() => setCalView(new Date(calYr, calMo+1, 1))} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'4px', padding:'2px 10px', cursor:'pointer', fontSize:'14px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'6px 4px 2px' }}>
        {['M','T','W','T','F','S','S'].map((dayLabel, dayIdx) => (
          <div key={dayIdx} style={{ textAlign:'center', fontSize:'9px', color:'var(--muted)', fontFamily:'DM Mono, monospace', fontWeight:600, padding:'2px 0' }}>{dayLabel}</div>
        ))}
        {calGrid.map((calNum, gridIdx) => {
          if (!calNum) return <div key={gridIdx} />
          const dateStr = makeDateStr(calYr, calMo, calNum)
          const isToday = dateStr === calTodayStr
          const isSel = dateStr === selected
          const hasDot = dotDates.has(dateStr)
          return (
            <div key={gridIdx} onClick={() => onSelect(dateStr)}
              style={{ textAlign:'center', padding:'4px 2px', cursor:'pointer', borderRadius:'5px', margin:'1px',
                background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-dim)' : 'transparent' }}
              onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='rgba(14,165,233,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isSel ? 'var(--accent)' : isToday ? 'var(--accent-dim)' : 'transparent' }}>
              <div style={{ fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight: isSel||isToday?700:400, color: isSel?'#fff':isToday?'var(--accent)':'var(--text)' }}>{calNum}</div>
              {hasDot && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:isSel?'#fff':'var(--accent)', margin:'0 auto' }} />}
            </div>
          )
        })}
      </div>
      <div style={{ padding:'8px', borderTop:'1px solid var(--border)' }}>
        <button onClick={() => onSelect(calTodayStr)} style={{ width:'100%', padding:'5px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>Today</button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0,10))
  const [allNotes, setAllNotes] = useState([])
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
  const [fontSize, setFontSize] = useState('20px')
  const [isShared, setIsShared] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
  const [sharedNotes, setSharedNotes] = useState([])
  const editorRef = useRef(null)
  const fileRef = useRef(null)

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

  const loadAll = useCallback(async (silent = false) => {
    const token = await getToken()
    const notesRes = await fetch('/api/notes', { headers:{ Authorization:`Bearer ${token}` } })
    const notesData = await notesRes.json()
    if (Array.isArray(notesData)) setAllNotes(notesData)
  }, [getToken])

  useEffect(() => { if (session) loadAll() }, [session, loadAll])

  // Silent refresh on tab focus
  useEffect(() => {
    const onFocus = () => { if (session) { loadAll(true); if (selectedDate) loadNote(selectedDate) } }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session, selectedDate, loadAll]) // eslint-disable-line

  const loadNote = useCallback(async (date) => {
    const token = await getToken()
    const noteRes = await fetch(`/api/notes?date=${date}`, { headers:{ Authorization:`Bearer ${token}` } })
    const noteData = await noteRes.json()
    const note = Array.isArray(noteData) && noteData.length > 0 ? noteData[0] : null
    if (editorRef.current) editorRef.current.innerHTML = note?.content || ''
    setTickers(note?.tickers || [])
    setImageUrls(note?.image_urls || [])
    setIsShared(note?.is_shared || false)
    // Load stock prices for tickers
    const noteTickers = note?.tickers || []
    noteTickers.forEach(sym => fetchStock(sym))
  }, [getToken]) // eslint-disable-line

  useEffect(() => { if (session && selectedDate) loadNote(selectedDate) }, [session, selectedDate]) // eslint-disable-line

  const loadShared = useCallback(async () => {
    const token = await getToken()
    const sharedRes = await fetch('/api/notes?shared=1', { headers:{ Authorization:`Bearer ${token}` } })
    const sharedData = await sharedRes.json()
    if (Array.isArray(sharedData)) setSharedNotes(sharedData)
  }, [getToken])

  useEffect(() => { if (session) loadShared() }, [session]) // eslint-disable-line

  const fetchStock = async (sym) => {
    try {
      const stockRes = await fetch(`/api/stock/${sym}`)
      const stockData = await stockRes.json()
      if (stockData.price) setStockCards(prev => ({...prev, [sym]: stockData}))
    } catch {}
  }

  const searchTicker = async (q) => {
    setTickerInput(q.toUpperCase())
    if (q.length < 2) { setTickerSuggestions([]); setShowDrop(false); return }
    try {
      const searchResp = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`)
      const searchData = await searchResp.json()
      setTickerSuggestions(Array.isArray(searchData) ? searchData : [])
      setShowDrop(true)
    } catch {}
  }

  const addTicker = (sym) => {
    setTickerInput('')
    setShowDrop(false)
    setTickerSuggestions([])
    if (!tickers.includes(sym)) {
      setTickers(prev => [...prev, sym])
      fetchStock(sym)
    }
  }

  const removeTicker = (sym) => {
    setTickers(prev => prev.filter(t => t !== sym))
    setStockCards(prev => { const prevCards = {...prev}; delete prevCards[sym]; return prevCards })
  }

  // Rich text formatting
  const fmtCmd = (cmd, value) => {
    if (typeof document === 'undefined') return
    editorRef.current?.focus()
    try { document.execCommand(cmd, false, value) } catch(e) {}
  }
  const applyColor = (color) => fmtCmd('foreColor', color)
  const applySize = (size) => {
    setFontSize(size)
    if (editorRef.current) editorRef.current.style.fontSize = size
  }
  const getEditorContent = () => editorRef.current?.innerHTML || ''

  const handleShare = async () => {
    const token = await getToken()
    if (!token) return
    setSharing(true); setShareMsg('')
    const newShared = !isShared
    const shareRes = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ note_date: selectedDate, content: getEditorContent(), tickers, image_urls: imageUrls, is_shared: newShared })
    })
    const shareResp = await shareRes.json()
    if (!shareResp.error) { setIsShared(newShared); setShareMsg(newShared ? '✓ Shared with subscribers' : '✓ Unshared') }
    setSharing(false)
    setTimeout(() => setShareMsg(''), 2000)
  }

  const handleSave = async () => {
    const token = await getToken()
    setSaving(true); setSaveMsg('')
    try {
      const saveRes = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ note_date: selectedDate, content: getEditorContent(), tickers, image_urls: imageUrls, is_shared: isShared })
      })
      const saveResp = await saveRes.json()
      if (saveResp.error) { setSaveMsg('Error: ' + saveResp.error) }
      else { setSaveMsg('✓ Saved!'); loadAll() }
    } catch (err) { setSaveMsg('Error saving') }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUploading(true)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('image', file)
      const imgRes = await fetch('/api/upload-note-image', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      const imgResp = await imgRes.json()
      if (imgResp.url) setImageUrls(prev => [...prev, imgResp.url])
    } catch (err) { console.error('Image upload error:', err) }
    setImgUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeImage = (url) => {
    if (!window.confirm('🗑 Remove this photo from the note?')) return
    setImageUrls(prev => prev.filter(u => u !== url))
  }

  const doSearch = async () => {
    if (!searchQ.trim()) { setSearchResults([]); return }
    setSearching(true)
    const token = await getToken()
    const searchRes2 = await fetch(`/api/notes?search=${encodeURIComponent(searchQ)}`, { headers:{ Authorization:`Bearer ${token}` } })
    const searchResp2 = await searchRes2.json()
    setSearchResults(Array.isArray(searchResp2) ? searchResp2 : [])
    setSearching(false)
  }

  const dotDates = new Set(allNotes.map(n => n.note_date))
  const displayDate = new Date(selectedDate+'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  if (!session) return null

  const COLORS = ['#ef4444','#22c55e','#0ea5e9','#f59e0b','#8b5cf6','#ec4899','#2c1810','#94a3b8']

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
          <div className="header-brand" style={{ fontFamily:'Bookman Old Style, serif', fontWeight:800, fontSize:'15px', color:'var(--text)' }}>CHiiRAG <span style={{ color:'var(--accent)' }}>STOCK Journal</span></div>
        </div>
        <NavPill active="Notes" isAdmin={isAdmin} />
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href='/' }}
          className="btn btn-ghost" style={{ padding:'6px 12px', fontSize:'11px' }}>EXIT ▾</button>
      </header>

      <main style={{ maxWidth:'100%', padding:'72px 20px 40px' }}>

        {/* MY NOTES */}
        {(
          <div style={{ display:'flex', gap:'20px', alignItems:'flex-start' }}>

            {/* Sidebar */}
            <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:'12px' }}>
              <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} dotDates={dotDates} />

              {/* Search */}
              <div style={{ width:'220px' }}>
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && doSearch()}
                    placeholder="🔍 Search notes..."
                    style={{ flex:1, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'6px 10px', color:'var(--text)', fontSize:'11px', fontFamily:'DM Mono, monospace', outline:'none' }} />
                  <button onClick={doSearch} disabled={searching}
                    style={{ padding:'6px 10px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>
                    {searching ? '...' : 'Go'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div style={{ marginTop:'8px', background:'var(--surface)', border:'1px solid var(--accent)', borderRadius:'8px', padding:'8px', maxHeight:'200px', overflowY:'auto' }}>
                    <div style={{ fontSize:'10px', color:'var(--accent)', fontFamily:'DM Mono, monospace', fontWeight:700, marginBottom:'6px' }}>{searchResults.length} results</div>
                    {searchResults.map(n => (
                      <div key={n.id} onClick={() => { setSelectedDate(n.note_date); setSearchResults([]); setSearchQ('') }}
                        style={{ padding:'6px 8px', cursor:'pointer', borderRadius:'5px', marginBottom:'3px', fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        📅 {n.note_date}
                      </div>
                    ))}
                    <button onClick={() => { setSearchResults([]); setSearchQ('') }}
                      style={{ width:'100%', marginTop:'4px', padding:'4px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--muted)', cursor:'pointer', fontSize:'10px', fontFamily:'DM Mono, monospace' }}>
                      ✕ Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Recent notes */}
              {allNotes.length > 0 && (
                <div style={{ width:'220px' }}>
                  <div style={{ fontSize:'10px', color:'var(--muted)', fontFamily:'DM Mono, monospace', letterSpacing:'0.1em', marginBottom:'6px' }}>RECENT NOTES</div>
                  {allNotes.slice(0,8).map(n => (
                    <div key={n.id} onClick={() => setSelectedDate(n.note_date)}
                      style={{ padding:'6px 10px', cursor:'pointer', borderRadius:'6px', marginBottom:'3px',
                        background: n.note_date===selectedDate ? 'var(--accent-dim)' : 'transparent',
                        border: n.note_date===selectedDate ? '1px solid var(--accent)' : '1px solid transparent' }}
                      onMouseEnter={e => { if(n.note_date!==selectedDate) e.currentTarget.style.background='var(--surface)' }}
                      onMouseLeave={e => { if(n.note_date!==selectedDate) e.currentTarget.style.background='transparent' }}>
                      <div style={{ fontFamily:'DM Mono, monospace', fontSize:'10px', fontWeight:700, color:n.note_date===selectedDate?'var(--accent)':'var(--muted)' }}>
                        {new Date(n.note_date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                        {n.tickers?.length>0 && <span style={{ marginLeft:'6px', color:'var(--gold)', fontSize:'9px' }}>{n.tickers[0]}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Main editor */}
            <div style={{ flex:1, minWidth:0 }}>

              {/* Date + actions bar */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
                <div style={{ fontFamily:'Caveat, cursive', fontSize:'18px', color:'var(--muted)' }}>{displayDate}</div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  {/* Ticker input */}
                  <div style={{ position:'relative' }}>
                    <input value={tickerInput} onChange={e => searchTicker(e.target.value)}
                      onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                      placeholder="📈 Add ticker..."
                      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'6px 10px', color:'var(--text)', fontSize:'11px', fontFamily:'DM Mono, monospace', width:'140px', outline:'none', textTransform:'uppercase' }} />
                    {showDrop && tickerSuggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:'6px', boxShadow:'0 8px 20px rgba(0,0,0,0.2)', maxHeight:'180px', overflowY:'auto', minWidth:'200px', marginTop:'2px' }}>
                        {tickerSuggestions.map((item, dropIdx) => (
                          <div key={dropIdx} onMouseDown={() => addTicker(item.ticker)}
                            style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--surface)'}
                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                            <div>
                              <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'12px', color:'var(--accent)' }}>{item.ticker}</div>
                              <div style={{ fontSize:'10px', color:'var(--muted)' }}>{item.shortName}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Image upload */}
                  <button onClick={() => fileRef.current?.click()} disabled={imgUploading}
                    style={{ padding:'6px 10px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace' }}>
                    {imgUploading ? '⏳' : '📷 Photo'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display:'none' }} />
                  {/* Admin: Share */}
                  {isAdmin && (
                    <button onClick={handleShare} disabled={sharing}
                      style={{ padding:'6px 12px', background:isShared?'rgba(0,230,118,0.1)':'var(--surface)', border:`1px solid ${isShared?'var(--bull)':'var(--border)'}`, color:isShared?'var(--bull)':'var(--muted)', borderRadius:'6px', cursor:'pointer', fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>
                      {sharing ? '...' : isShared ? '🔗 Shared' : '🔗 Share'}
                    </button>
                  )}
                  {shareMsg && <span style={{ fontSize:'11px', color:'var(--bull)', fontFamily:'DM Mono, monospace' }}>{shareMsg}</span>}
                  {/* SAVE BUTTON */}
                  <button onClick={handleSave} disabled={saving}
                    style={{ padding:'7px 18px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontFamily:'DM Mono, monospace', fontWeight:700, opacity:saving?0.7:1 }}>
                    {saving ? 'Saving...' : '💾 Save'}
                  </button>
                  {saveMsg && <span style={{ fontSize:'11px', color:'var(--bull)', fontFamily:'DM Mono, monospace' }}>{saveMsg}</span>}
                </div>
              </div>

              {/* Ticker stock cards */}
              {tickers.length > 0 && (
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
                  {tickers.map(sym => {
                    const tickerSd = stockCards[sym]
                    const tickerIsUp = tickerSd ? tickerSd.change >= 0 : true
                    return (
                      <div key={sym} style={{ display:'flex', alignItems:'center', gap:'10px', background:tickerIsUp?'rgba(0,230,118,0.06)':'rgba(239,68,68,0.06)', border:`1px solid ${tickerIsUp?'rgba(0,230,118,0.25)':'rgba(239,68,68,0.25)'}`, borderRadius:'8px', padding:'7px 12px' }}>
                        <div>
                          <div style={{ fontFamily:'DM Mono, monospace', fontWeight:800, fontSize:'13px', color:'var(--text)' }}>{sym}</div>
                          {tickerSd && <div style={{ fontSize:'10px', color:'var(--muted)' }}>{tickerSd.shortName||''}</div>}
                        </div>
                        {tickerSd && (
                          <div>
                            <div style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'14px', color:tickerIsUp?'var(--bull)':'var(--bear)' }}>
                              Rs.{Number(tickerSd.price).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                            </div>
                            <div style={{ fontSize:'10px', color:tickerIsUp?'var(--bull)':'var(--bear)', fontFamily:'DM Mono, monospace' }}>
                              {tickerIsUp?'+':''}{Number(tickerSd.changePercent||0).toFixed(2)}%
                            </div>
                          </div>
                        )}
                        <button onClick={() => removeTicker(sym)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'14px', padding:'0 2px' }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Formatting toolbar */}
              <div style={{ display:'flex', gap:'6px', alignItems:'center', padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px 8px 0 0', flexWrap:'wrap' }}>
                <button onClick={() => fmtCmd('bold')} title="Bold" style={{ padding:'4px 10px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', cursor:'pointer', fontWeight:700, fontSize:'13px', fontFamily:'DM Mono, monospace' }}>B</button>
                <button onClick={() => fmtCmd('italic')} title="Italic" style={{ padding:'4px 10px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', cursor:'pointer', fontStyle:'italic', fontSize:'13px', fontFamily:'DM Mono, monospace' }}>I</button>
                <button onClick={() => fmtCmd('underline')} title="Underline" style={{ padding:'4px 10px', background:'none', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', cursor:'pointer', textDecoration:'underline', fontSize:'13px', fontFamily:'DM Mono, monospace' }}>U</button>
                <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />
                {/* Font size */}
                <select value={fontSize} onChange={e => applySize(e.target.value)}
                  style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', padding:'3px 6px', fontSize:'11px', fontFamily:'DM Mono, monospace', cursor:'pointer' }}>
                  <option value="16px">Small</option>
                  <option value="20px">Medium</option>
                  <option value="26px">Large</option>
                  <option value="32px">X-Large</option>
                </select>
                <div style={{ width:'1px', height:'20px', background:'var(--border)', margin:'0 4px' }} />
                {/* Color swatches */}
                {COLORS.map(col => (
                  <button key={col} onClick={() => applyColor(col)} title={col}
                    style={{ width:'18px', height:'18px', borderRadius:'50%', background:col, border:`2px solid ${col === '#2c1810' ? '#888' : col}`, cursor:'pointer', flexShrink:0 }} />
                ))}
              </div>

              {/* Paper editor */}
              <div style={{ position:'relative', background:'#fefef8', border:'1px solid #e8e0c8', borderTop:'none', borderRadius:'0 0 8px 8px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', minHeight:'500px', overflow:'hidden' }}>
                {/* Margin line */}
                <div style={{ position:'absolute', left:'56px', top:0, bottom:0, width:'1px', background:'rgba(220,60,60,0.25)', zIndex:1 }} />
                {/* Hole punches */}
                {[60, 250, 440].map(top => (
                  <div key={top} style={{ position:'absolute', left:'20px', top:`${top}px`, width:'14px', height:'14px', borderRadius:'50%', background:'#f0ebe0', border:'1px solid #d4cbb8', zIndex:2 }} />
                ))}
                {/* Ruled lines */}
                <div style={{ position:'absolute', left:0, right:0, top:0, bottom:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
                  {Array.from({length:30}).map((_,rIdx) => (
                    <div key={rIdx} style={{ position:'absolute', left:0, right:0, top:`${rIdx*32+8}px`, height:'1px', background:'rgba(100,149,237,0.15)' }} />
                  ))}
                </div>
                {/* ContentEditable editor */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  style={{ position:'relative', zIndex:3, minHeight:'490px', padding:'10px 16px 16px 70px', fontFamily:'Caveat, cursive', fontSize:fontSize, color:'#2c1810', lineHeight:'32px', outline:'none', whiteSpace:'pre-wrap', wordBreak:'break-word' }}
                />
              </div>

              {/* Images */}
              {imageUrls.length > 0 && (
                <div style={{ marginTop:'12px' }}>
                  <div style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace', marginBottom:'8px' }}>ATTACHED PHOTOS</div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    {imageUrls.map((url, imgIdx) => (
                      <div key={imgIdx} style={{ position:'relative', border:'2px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
                        <img src={url} alt="" style={{ width:'140px', height:'100px', objectFit:'cover', display:'block' }} />
                        <button onClick={() => removeImage(url)}
                          style={{ position:'absolute', top:'4px', right:'4px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:'20px', height:'20px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SHARED NOTES (admin shares shown below for all users) */}
        {sharedNotes.length > 0 && (
          <div style={{ marginTop:'40px', paddingTop:'32px', borderTop:'2px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
              <span style={{ fontFamily:'Bookman Old Style, serif', fontWeight:700, fontSize:'16px', color:'var(--text)' }}>🔗 Shared by Admin</span>
              <span style={{ fontSize:'11px', background:'var(--accent-dim)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px', fontFamily:'DM Mono, monospace', fontWeight:700 }}>READ ONLY</span>
              <span style={{ fontSize:'11px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>{sharedNotes.length} note{sharedNotes.length>1?'s':''}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {sharedNotes.map(note => (
                <div key={note.id} style={{ background:'#fefef8', border:'1px solid #e8e0c8', borderRadius:'8px', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', overflow:'hidden', borderLeft:'4px solid var(--gold)' }}>
                  <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(173,140,100,0.2)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(245,158,11,0.04)' }}>
                    <div style={{ fontFamily:'Caveat, cursive', fontSize:'16px', color:'#5a4a3a', fontWeight:600 }}>
                      {new Date(note.note_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {(note.tickers||[]).map(sym => (
                        <span key={sym} style={{ fontFamily:'DM Mono, monospace', fontWeight:700, fontSize:'10px', color:'var(--gold)', background:'rgba(245,158,11,0.1)', padding:'2px 7px', borderRadius:'4px' }}>{sym}</span>
                      ))}
                    </div>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: note.content || '<i style="color:rgba(44,24,16,0.3)">No content</i>' }}
                    style={{ padding:'12px 16px', fontFamily:'Caveat, cursive', fontSize:'19px', color:'#2c1810', lineHeight:'32px', minHeight:'80px' }} />
                  {(note.image_urls||[]).length > 0 && (
                    <div style={{ padding:'0 16px 12px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {note.image_urls.map((url,imgI) => (
                        <img key={imgI} src={url} alt="" style={{ width:'100px', height:'70px', objectFit:'cover', borderRadius:'5px', border:'1px solid #e8e0c8' }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
