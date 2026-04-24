import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// ── Secure storage adapter for Supabase session ─────────────────────────────
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
})

// ── Sign in / out helpers ────────────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
