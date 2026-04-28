import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'

WebBrowser.maybeCompleteAuthSession()

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
})

// ── Google Sign-In ────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const redirectUrl = AuthSession.makeRedirectUri({ native: 'smkjournal://callback' })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:          redirectUrl,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned from Supabase')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

  if (result.type === 'success') {
    const url = result.url
    let access_token  = null
    let refresh_token = null

    if (url.includes('#')) {
      const hash   = url.split('#')[1]
      const params = new URLSearchParams(hash)
      access_token  = params.get('access_token')
      refresh_token = params.get('refresh_token')
    }

    if (!access_token && url.includes('?')) {
      const query  = url.split('?')[1]
      const params = new URLSearchParams(query)
      access_token  = params.get('access_token')
      refresh_token = params.get('refresh_token')
    }

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (sessionError) throw sessionError
      return { type: 'success' }
    }
  }

  return result
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
