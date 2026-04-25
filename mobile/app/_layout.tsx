import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from '../context/AuthContext'
import { colors } from '../lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style="dark" backgroundColor={colors.bg} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)"  />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
