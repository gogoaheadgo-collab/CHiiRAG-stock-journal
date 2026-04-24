import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { checkApproval } from '../lib/api'

type Role = 'admin' | 'approved' | 'pending' | 'denied' | null

interface AuthCtx {
  session:  Session | null
  role:     Role
  loading:  boolean
  refresh:  () => void
}

const AuthContext = createContext<AuthCtx>({ session: null, role: null, loading: true, refresh: () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null)
  const [role,    setRole]      = useState<Role>(null)
  const [loading, setLoading]   = useState(true)

  async function resolveRole(s: Session | null) {
    if (!s) { setRole(null); setLoading(false); return }
    try {
      const res = await checkApproval()
      const status = res?.status
      if (status === 'approved' || status === 'requeued') setRole('approved')
      else if (status === 'pending')                      setRole('pending')
      else                                                setRole('denied')
    } catch {
      setRole('pending')
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      resolveRole(s)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(true)
      resolveRole(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  const refresh = () => { setLoading(true); resolveRole(session) }

  return (
    <AuthContext.Provider value={{ session, role, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
