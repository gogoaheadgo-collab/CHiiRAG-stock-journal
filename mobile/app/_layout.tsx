import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from '../context/AuthContext'
import { colors } from '../lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <Stack
          screenOptions={{
            headerStyle:      { backgroundColor: colors.bg },
            headerTintColor:  colors.textPrimary,
            headerTitleStyle: { fontFamily: 'SpaceMono', fontSize: 13, letterSpacing: 1 },
            contentStyle:     { backgroundColor: colors.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
          <Stack.Screen name="(app)"   options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
