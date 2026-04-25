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
    // DM Mono — used for labels, numbers, monospace data
    DMmono: require('../assets/fonts/DMMono-Regular.ttf'),
    DMmonoBold: require('../assets/fonts/DMMono-Medium.ttf'),
    // Libre Baskerville — Bookman Old Style substitute for headings/values
    LibreBaskerville: require('../assets/fonts/LibreBaskerville-Regular.ttf'),
    LibreBaskervilleBold: require('../assets/fonts/LibreBaskerville-Bold.ttf'),
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AuthProvider>
        <StatusBar style="dark" backgroundColor={colors.bg} />
        <Stack
          screenOptions={{
            headerStyle:      { backgroundColor: colors.bg },
            headerTintColor:  colors.text,
            headerTitleStyle: { fontFamily: 'LibreBaskervilleBold', fontSize: 14 },
            contentStyle:     { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerBorderColor: colors.border,
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
