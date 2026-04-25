import { Tabs, Redirect } from 'expo-router'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { colors, font } from '../../lib/theme'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 18 : 16, opacity: focused ? 1 : 0.5 }}>
      {label}
    </Text>
  )
}

export default function AppLayout() {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!session) return <Redirect href="/(auth)/login" />
  if (role === 'pending') return <Redirect href="/(auth)/pending" />

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   6,
          height:          56,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: 'DMmono',
          fontSize:   font.size.xs,
          letterSpacing: 0.5,
        },
        headerStyle:      { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor:  colors.text,
        headerTitleStyle: { fontFamily: 'LibreBaskervilleBold', fontSize: 15 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'DASHBOARD', tabBarIcon: ({ focused }) => <TabIcon label="📊" focused={focused} /> }} />
      <Tabs.Screen name="trades"    options={{ title: 'TRADES',    tabBarIcon: ({ focused }) => <TabIcon label="📈" focused={focused} /> }} />
      <Tabs.Screen name="notes"     options={{ title: 'NOTES',     tabBarIcon: ({ focused }) => <TabIcon label="📝" focused={focused} /> }} />
      <Tabs.Screen name="alerts"    options={{ title: 'ALERTS',    tabBarIcon: ({ focused }) => <TabIcon label="🔔" focused={focused} /> }} />
      <Tabs.Screen name="bank"      options={{ title: 'BANK',      tabBarIcon: ({ focused }) => <TabIcon label="🏦" focused={focused} /> }} />
      <Tabs.Screen name="profile"   options={{ title: 'PROFILE',   tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
})
