import { useRouter } from 'next/router'
import { useState } from 'react'

const ITEMS = [
  { label: 'Dashboard',       path: '/dashboard',       icon: '◈' },
  { label: 'Accounts',        path: '/accounts',        icon: '◰' },
  { label: 'All Trades',      path: '/all-trades',      icon: '◫' },
  { label: 'Bank',            path: '/bank',            icon: '◧' },
  { label: 'Alerts',          path: '/alerts',          icon: '◉' },
  { label: 'Notes',           path: '/notes',           icon: '◱' },
]
const ADMIN_ITEMS = [
  { label: 'Subscribers',     path: '/subscribers',     icon: '◎' },
  { label: 'Revenue Sharing', path: '/revenue-sharing', icon: '◍' },
]

export default function Sidebar({ active, isAdmin, user, onSignOut, onDeleteAccount }) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = (path) => { setMobileOpen(false); router.push(path) }
  const email = user?.email || ''
  const initials = (user?.user_metadata?.full_name || email).slice(0, 2).toUpperCase()

  const NavItem = ({ label, path, icon }) => {
    const isActive = active === label
    return (
      <button onClick={() => navigate(path)} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '9px 16px', border: 'none', cursor: 'pointer',
        background: isActive ? 'rgba(0,180,255,0.08)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: isActive ? 700 : 500,
        textAlign: 'left', transition: 'all 0.12s', borderRadius: '0 6px 6px 0',
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = 'var(--text)' }}}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
        {label}
      </button>
    )
  }

  const sidebarContent = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '0 0 16px',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 18px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mini India Flag */}
          <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ flex: 1, background: '#FF9933' }} />
            <div style={{ flex: 1, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', border: '1px solid #000080' }} />
            </div>
            <div style={{ flex: 1, background: '#138808' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Bookman Old Style, Libre Baskerville, Georgia, serif', fontWeight: 800, fontSize: '14px', color: 'var(--text)', lineHeight: 1.1 }}>CHiiRAG</div>
            <div style={{ fontFamily: 'Bookman Old Style, Libre Baskerville, Georgia, serif', fontSize: '10px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.05em' }}>STOCK Journal</div>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '4px 18px 8px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>Journal</div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
        {ITEMS.map(item => <NavItem key={item.path} {...item} />)}
        {isAdmin && (
          <>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 8px' }} />
            <div style={{ padding: '2px 8px 4px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' }}>Admin</div>
            {ADMIN_ITEMS.map(item => <NavItem key={item.path} {...item} />)}
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom user info */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>{initials}</div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontFamily: 'DM Mono, monospace', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          </div>
        </div>
        <button onClick={onSignOut} style={{ width: '100%', padding: '7px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 600 }}>
          Sign Out
        </button>
        {onDeleteAccount && (
          <button onClick={onDeleteAccount} style={{ width: '100%', marginTop: '4px', padding: '5px', border: 'none', background: 'transparent', color: 'var(--bear)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '10px' }}>
            Delete Account
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="sidebar-desktop" style={{
        position: 'fixed', left: 0, top: 0, width: '240px', height: '100vh',
        background: 'white', borderRight: '1px solid var(--border)',
        zIndex: 40, overflowY: 'auto',
      }}>
        {sidebarContent}
      </div>

      {/* Mobile top bar */}
      <div className="sidebar-mobile-bar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, height: '52px',
        background: 'white', borderBottom: '1px solid var(--border)', zIndex: 40,
        alignItems: 'center', padding: '0 16px', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: 'Bookman Old Style, serif', fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>
          CHiiRAG <span style={{ color: 'var(--accent)' }}>STOCK</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
          padding: '6px 10px', cursor: 'pointer', color: 'var(--text)',
        }}>☰</button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
        }}>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{
            position: 'absolute', left: 0, top: 0, width: '240px', height: '100vh',
            background: 'white', borderRight: '1px solid var(--border)', overflowY: 'auto',
          }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
