import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'

// ── Tell Expo to complete the auth session in the browser ────────────────────
WebBrowser.maybeCompleteAuthSession()

// ── Secure storage adapter ───────────────────────────────────────────────────
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
    detectSessionInUrl: false,  // must be false for React Native
  },
})

// ── Email / password ─────────────────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ── Google OAuth ─────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  // Build the redirect URI — works for both Expo Go and standalone APK
  const redirectUrl = AuthSession.makeRedirectUri({
    scheme: 'smkjournal',
    path:   'auth/callback',
  })

  // Ask Supabase for the Google OAuth URL
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:         redirectUrl,
      skipBrowserRedirect: true,   // we open the browser manually below
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  // Open the Google sign-in page in the device browser
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

  if (result.type === 'success' && result.url) {
    // Extract tokens from the redirect URL and give them to Supabase
    const url = new URL(result.url)
    const params = new URLSearchParams(
      url.hash ? url.hash.replace('#', '') : url.search.replace('?', '')
    )
    const access_token  = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (sessionError) throw sessionError
    }
  }

  return result
}

// ── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
