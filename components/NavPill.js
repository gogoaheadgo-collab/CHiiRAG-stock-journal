import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'

export default function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const items = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Accounts', path: '/accounts' },
    { label: 'Bank', path: '/bank' },
    ...(isAdmin ? [
      { label: 'Subscribers', path: '/subscribers' },
      { label: 'All Trades', path: '/all-trades' },
    ] : []),
    { label: 'Revenue Sharing', path: '/revenue-sharing' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notes', path: '/notes' },
  ]

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [router.pathname])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('.nav-drawer') && !e.target.closest('.nav-hamburger')) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const navigate = (path) => { setOpen(false); router.push(path) }

  return (
    <>
      {/* Desktop pill */}
      <div className="navpill-desktop" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', gap: '2px', flexWrap: 'wrap' }}>
        {items.map(({ label, path }) => (
          <button key={path} onClick={() => navigate(path)} style={{
            padding: '7px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 600,
            background: active === label ? 'var(--accent)' : 'transparent',
            color: active === label ? '#fff' : 'var(--muted)',
            transition: 'background 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Mobile hamburger */}
      <button className="nav-hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
        <span style={{ transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none', transition: 'transform 0.2s' }} />
        <span style={{ opacity: open ? 0 : 1, transition: 'opacity 0.2s' }} />
        <span style={{ transform: open ? 'rotate(-45deg) translate(5px, -5px)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Mobile drawer */}
      <div className={`nav-drawer${open ? ' open' : ''}`}>
        <div style={{ fontSize: '9px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', padding: '4px 14px 6px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
          NAVIGATE
        </div>
        {items.map(({ label, path }) => (
          <button key={path} onClick={() => navigate(path)}
            className={active === label ? 'active' : ''}>
            {active === label ? '▸ ' : ''}{label}
          </button>
        ))}
      </div>
    </>
  )
}
