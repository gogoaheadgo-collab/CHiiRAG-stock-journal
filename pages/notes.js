import dynamic from 'next/dynamic'

const NotesPage = dynamic(() => import('../components/NotesComponent'), { 
  ssr: false,
  loading: () => (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace', fontSize:'13px' }}>Loading Notes...</div>
    </div>
  )
})

export default function Notes() {
  return <NotesPage />
}
