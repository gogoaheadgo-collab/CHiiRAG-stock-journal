import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'gogoaheadgo@gmail.com'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [approvalStatus, setApprovalStatus] = useState(null) // null | 'pending' | 'rejected' | 'requeued'
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  const checkApproval = async (session) => {
    if (session.user.email === ADMIN_EMAIL) { router.replace('/dashboard'); return }
    const token = session.access_token
    const res = await fetch('/api/check-approval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.status === 'approved') { router.replace('/dashboard'); return }
    setApprovalStatus(data.status) // 'pending', 'requeued', or 'rejected'
    setUserEmail(session.user.email)
    setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0])
    setChecking(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (session) checkApproval(session)
      else setChecking(false)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s) checkApproval(s)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  const signIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: typeof window!=='undefined' ? window.location.origin : '' } })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setApprovalStatus(null)
    setChecking(false)
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ color:'var(--muted)' }}>Loading...</div>
    </div>
  )

  // Pending approval screen
  if (approvalStatus === 'pending') return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Awaiting Approval — CHiiRAG Stock Journal</title></Head>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div style={{ textAlign:'center', maxWidth:'440px', padding:'40px 24px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize:'56px', marginBottom:'16px' }}>⏳</div>
          <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:'0 0 10px' }}>
            Awaiting Approval
          </h2>
          <p style={{ color:'var(--muted)', fontSize:'13px', lineHeight:1.7, marginBottom:'20px' }}>
            Hi <strong style={{ color:'var(--text)' }}>{userName}</strong>,<br/>
            Your access request has been submitted.<br/>
            The admin will review and approve your account shortly.
          </p>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'12px 16px', marginBottom:'24px', fontSize:'12px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>
            📧 {userEmail}
          </div>
          <p style={{ color:'var(--muted)', fontSize:'11px', marginBottom:'20px', fontFamily:'DM Mono, monospace' }}>
            You will receive an email once approved. Try logging in again after approval.
          </p>
          <button onClick={signOut} style={{ padding:'10px 24px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'8px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  )

  // Re-queued screen — shown once after a rejection, before they wait for re-approval
  if (approvalStatus === 'requeued') return (
    <>
      <div className="tricolor-bar" />
      <Head><title>Re-Requested Access — CHiiRAG Stock Journal</title></Head>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div style={{ textAlign:'center', maxWidth:'440px', padding:'40px 24px', background:'var(--surface)', border:'2px solid var(--gold)', borderRadius:'16px', boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize:'56px', marginBottom:'16px' }}>🔄</div>
          <h2 style={{ fontFamily:'Bookman Old Style, serif', fontSize:'22px', fontWeight:800, color:'var(--text)', margin:'0 0 10px' }}>
            Access Re-Requested
          </h2>
          <p style={{ color:'var(--muted)', fontSize:'13px', lineHeight:1.7, marginBottom:'20px' }}>
            Hi <strong style={{ color:'var(--text)' }}>{userName}</strong>,<br/>
            Your previous request was declined.<br/>
            You have been <strong style={{ color:'var(--gold)' }}>re-queued for approval</strong>.<br/>
            The admin will review your request again shortly.
          </p>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'12px 16px', marginBottom:'24px', fontSize:'12px', color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>
            📧 {userEmail}
          </div>
          <p style={{ color:'var(--muted)', fontSize:'11px', marginBottom:'20px', fontFamily:'DM Mono, monospace' }}>
            You will receive an email once approved.
          </p>
          <button onClick={signOut} style={{ padding:'10px 24px', background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:'8px', cursor:'pointer', fontFamily:'DM Mono, monospace', fontSize:'12px' }}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  )

  // Login screen
  return (
    <>
      <div className="tricolor-bar" />
      <Head><title>CHiiRAG Stock Journal</title></Head>
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
          <p style={{ color:'var(--muted)', fontSize:'10px', marginTop:'16px', fontFamily:'DM Mono, monospace' }}>
            Access is by invitation only. New users require admin approval.
          </p>
        </div>
      </div>
    </>
  )
}
