import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

function IndiaFlagLogo({ size = 32 }) {
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'block' }}>
      <rect x="0" y="0" width={size} height={size / 3} fill="#FF9933" />
      <rect x="0" y={size / 3} width={size} height={size / 3} fill="#FFFFFF" />
      <rect x="0" y={size * 2 / 3} width={size} height={size / 3} fill="#138808" />
      <circle cx={r} cy={r} r={size * 0.14} fill="none" stroke="#000080" strokeWidth={size * 0.025} />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180
        const x1 = r + Math.cos(angle) * size * 0.03
        const y1 = r + Math.sin(angle) * size * 0.03
        const x2 = r + Math.cos(angle) * size * 0.13
        const y2 = r + Math.sin(angle) * size * 0.13
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000080" strokeWidth={size * 0.015} />
      })}
      <circle cx={r} cy={r} r={size * 0.025} fill="#000080" />
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#605B51" strokeWidth="2" />
    </svg>
  )
}

export default function ViewersPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [viewers, setViewers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingViewer, setEditingViewer] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', assigned_portfolios: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) { router.push('/'); return }
      if (session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        router.push('/denied'); return
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const loadData = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    setLoading(true)
    try {
      // Load viewers
      const vRes = await fetch('/api/viewers', { headers: { Authorization: `Bearer ${token}` } })
      const vData = await vRes.json()
      if (Array.isArray(vData)) setViewers(vData)

      // Load accounts (portfolios)
      const aRes = await fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } })
      const aData = await aRes.json()
      if (Array.isArray(aData)) setAccounts(aData)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { if (session) loadData() }, [session, loadData])

  const togglePortfolio = (portfolio) => {
    setForm(f => ({
      ...f,
      assigned_portfolios: f.assigned_portfolios.includes(portfolio)
        ? f.assigned_portfolios.filter(p => p !== portfolio)
        : [...f.assigned_portfolios, portfolio]
    }))
  }

  const handleSave = async () => {
    setError(''); setSuccess('')
    if (!form.email.trim()) return setError('Email is required')
    if (form.assigned_portfolios.length === 0) return setError('Assign at least one portfolio')

    setSaving(true)
    try {
      const token = await getToken()
      const method = editingViewer ? 'PUT' : 'POST'
      const body = editingViewer ? { id: editingViewer.id, ...form } : form

      const res = await fetch('/api/viewers', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.error) { setError(data.error); return }

      setSuccess(editingViewer ? 'Viewer updated!' : 'Viewer added!')
      setShowAdd(false); setEditingViewer(null)
      setForm({ email: '', name: '', assigned_portfolios: [] })
      await loadData()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleEdit = (viewer) => {
    setEditingViewer(viewer)
    setForm({ email: viewer.email, name: viewer.name || '', assigned_portfolios: viewer.assigned_portfolios || [] })
    setShowAdd(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this viewer? They will lose access immediately.')) return
    const token = await getToken()
    await fetch('/api/viewers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await loadData()
  }

  const signOut = () => supabase.auth.signOut().then(() => router.push('/'))

  return (
    <>
      <Head><title>Viewers — SMK Stock Journal</title></Head>

      <div style={{ height: '4px', background: 'linear-gradient(90deg, #FF9933 33.33%, #e8e8e8 33.33%, #e8e8e8 66.66%, #138808 66.66%)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }} />

      {/* Header */}
      <header style={{
        marginTop: '4px', background: 'rgba(255,248,222,0.97)',
        borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 40,
        height: '56px', display: 'flex', alignItems: 'center',
        padding: '0 20px', justifyContent: 'space-between',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IndiaFlagLogo size={32} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1f36', fontFamily: 'Libre Baskerville, Georgia, serif' }}>
            SMK <span style={{ color: '#0ea5e9' }}>· Viewer Access</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/')} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }}>
            ← Back to Journal
          </button>
          <button onClick={signOut} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: '12px' }}>Sign Out</button>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1f36', fontFamily: 'Libre Baskerville, Georgia, serif' }}>
              Viewer Access Control
            </h1>
            <p style={{ color: '#6b7a9e', fontSize: '12px', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>
              Manage who can view your portfolios · Read-only access
            </p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditingViewer(null); setForm({ email: '', name: '', assigned_portfolios: [] }) }}
            className="btn btn-primary"
            style={{ padding: '8px 18px' }}
          >
            + Add Viewer
          </button>
        </div>

        {success && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#16a34a', fontSize: '12px', marginBottom: '16px', fontFamily: 'DM Mono, monospace' }}>
            ✓ {success}
          </div>
        )}

        {/* Add / Edit Form */}
        {showAdd && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#1a1f36', marginBottom: '16px', fontFamily: 'Libre Baskerville, Georgia, serif' }}>
              {editingViewer ? '✎ Edit Viewer' : '+ New Viewer'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="field-label">Email Address *</label>
                <input
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="viewer@gmail.com" className="field" type="email"
                />
              </div>
              <div>
                <label className="field-label">Name (optional)</label>
                <input
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ravi" className="field"
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="field-label">Assign Portfolios *</label>
              {accounts.length === 0 ? (
                <div style={{ padding: '10px', color: '#6b7a9e', fontSize: '12px', fontFamily: 'DM Mono, monospace', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                  No portfolios found. Add accounts in the main journal first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {accounts.map(a => (
                    <button
                      key={a.id} type="button"
                      onClick={() => togglePortfolio(a.name)}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                        border: `2px solid ${form.assigned_portfolios.includes(a.name) ? '#0ea5e9' : '#605B51'}`,
                        background: form.assigned_portfolios.includes(a.name) ? '#e0f2fe' : 'var(--bg)',
                        color: form.assigned_portfolios.includes(a.name) ? '#0284c7' : '#6b7a9e',
                        fontSize: '12px', fontFamily: 'DM Mono, monospace', fontWeight: 600,
                        transition: 'all 0.15s',
                      }}
                    >
                      {form.assigned_portfolios.includes(a.name) ? '✓ ' : ''}{a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: '4px', color: '#dc2626', fontSize: '11px', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setEditingViewer(null); setError('') }} className="btn btn-ghost" style={{ padding: '7px 16px' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ padding: '7px 16px' }}>
                {saving ? 'Saving...' : editingViewer ? '💾 Update' : '+ Add Viewer'}
              </button>
            </div>
          </div>
        )}

        {/* Viewers List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7a9e', fontFamily: 'DM Mono, monospace' }}>Loading...</div>
        ) : viewers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7a9e' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👁️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'Libre Baskerville, Georgia, serif', marginBottom: '6px' }}>No Viewers Yet</div>
            <div style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace' }}>Click "+ Add Viewer" to give someone read-only access</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {viewers.map(viewer => (
              <div key={viewer.id} style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
                padding: '16px 18px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                      {(viewer.name || viewer.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1f36', fontFamily: 'Libre Baskerville, Georgia, serif' }}>
                        {viewer.name || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7a9e', fontFamily: 'DM Mono, monospace' }}>
                        {viewer.email}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(viewer.assigned_portfolios || []).map(p => (
                      <span key={p} style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                        background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd',
                        fontFamily: 'DM Mono, monospace', fontWeight: 600,
                      }}>{p}</span>
                    ))}
                    {(viewer.assigned_portfolios || []).length === 0 && (
                      <span style={{ fontSize: '11px', color: '#ef4444', fontFamily: 'DM Mono, monospace' }}>No portfolios assigned</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleEdit(viewer)} className="icon-btn" title="Edit" style={{ fontSize: '13px' }}>✎</button>
                  <button onClick={() => handleDelete(viewer.id)} className="icon-btn del" title="Remove access">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '24px', padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '11px', color: '#92400e', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
          🔒 <strong>How it works:</strong> Viewers login with their Google account. They can only see portfolios you assign to them. They cannot add, edit or delete any trades. Anyone not on this list is blocked with an "Access Denied" page.
        </div>
      </main>
    </>
  )
}
