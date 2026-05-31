import { supabase } from '../lib/supabase'

export default function AccessDenied() {
  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'Libre Baskerville, Georgia, serif',
    }}>
      {/* Tricolor top bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #FF9933 33.33%, #e8e8e8 33.33%, #e8e8e8 66.66%, #138808 66.66%)' }} />

      <div style={{ textAlign: 'center', maxWidth: '420px', padding: '32px' }}>
        {/* Lock icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: '#fee2e2', border: '2px solid #fecaca',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: '36px',
        }}>
          🔒
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1f36', marginBottom: '10px' }}>
          Access Denied
        </h1>

        <p style={{ color: '#6b7a9e', fontSize: '14px', lineHeight: 1.8, marginBottom: '8px', fontFamily: 'DM Mono, monospace' }}>
          Your Google account is not authorised to access this journal.
        </p>

        <p style={{ color: '#6b7a9e', fontSize: '13px', lineHeight: 1.8, marginBottom: '32px', fontFamily: 'DM Mono, monospace' }}>
          Please contact the portfolio owner to request access.
        </p>

        {/* Tricolor divider */}
        <div style={{ width: '80px', height: '3px', margin: '0 auto 28px', background: 'linear-gradient(90deg, #FF9933 33%, #e0e0e0 33%, #e0e0e0 66%, #138808 66%)', borderRadius: '2px' }} />

        <button
          onClick={signOut}
          style={{
            background: '#0ea5e9', color: 'white', border: 'none',
            padding: '10px 28px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'Libre Baskerville, Georgia, serif',
            fontWeight: 700,
          }}
        >
          ← Sign Out & Try Another Account
        </button>
      </div>
    </div>
  )
}
