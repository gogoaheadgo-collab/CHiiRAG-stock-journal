import { useEffect, useRef } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

function extractTokens(url: string) {
  for (const segment of [url.split('#')[1], url.split('?')[1]]) {
    if (!segment) continue
    const p = new URLSearchParams(segment)
    const access_token  = p.get('access_token')
    const refresh_token = p.get('refresh_token')
    if (access_token && refresh_token) return { access_token, refresh_token }
  }
  return null
}

export default function CallbackScreen() {
  const handled = useRef(false)

  useEffect(() => {
    async function tryUrl(url: string | null) {
      if (handled.current || !url) return
      const tokens = extractTokens(url)
      if (!tokens) return
      handled.current = true
      const { error } = await supabase.auth.setSession(tokens)
      router.replace(error ? '/(auth)/login' : '/(app)/dashboard')
    }

    Linking.getInitialURL().then(tryUrl)
    const sub = Linking.addEventListener('url', ({ url }) => tryUrl(url))

    // Fallback: if no tokens arrive within 3 s, return to login
    const timer = setTimeout(() => {
      if (!handled.current) router.replace('/(auth)/login')
    }, 3000)

    return () => { sub.remove(); clearTimeout(timer) }
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  )
}
