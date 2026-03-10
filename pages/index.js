import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s) router.replace('/dashboard')
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: typeof window!=='undefined' ? window.location.origin : '' } })
  }

  if (checking) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ color:'var(--muted)' }}>Loading...</div>
    </div>
  )

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
        </div>
      </div>
    </>
  )
}




