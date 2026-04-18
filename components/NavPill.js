import { useRouter } from 'next/router'

export default function NavPill({ active, isAdmin }) {
  const router = useRouter()
  const items = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Accounts', path: '/accounts' },
    ...(isAdmin ? [
      { label: 'Subscribers', path: '/subscribers' },
      { label: 'All Trades', path: '/all-trades' },
    ] : []),
    { label: 'Revenue Sharing', path: '/revenue-sharing' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Notes', path: '/notes' },
  ]
  return (
    <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', padding:'3px', gap:'2px', flexWrap:'wrap' }}>
      {items.map(({ label, path }) => (
        <button key={path} onClick={() => router.push(path)} style={{
          padding:'7px 16px', borderRadius:'6px', border:'none', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Mono, monospace', fontWeight:600,
          background: active===label ? 'var(--accent)' : 'transparent',
          color: active===label ? '#fff' : 'var(--muted)',
        }}>{label}</button>
      ))}
    </div>
  )
}
