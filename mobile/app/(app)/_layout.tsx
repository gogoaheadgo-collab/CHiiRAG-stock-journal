import { Tabs, Redirect } from 'expo-router'
import { View, Text, ActivityIndicator } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { colors, font } from '../../lib/theme'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{
      fontFamily: font.mono,
      fontSize: focused ? 18 : 16,
      color: focused ? colors.accent : colors.textMuted,
    }}>
      {label}
    </Text>
  )
}

export default function AppLayout() {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
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
          backgroundColor: colors.bgCard,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   8,
          height:          60,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: font.mono,
          fontSize:   font.size.xs,
          letterSpacing: 1,
        },
        headerStyle:      { backgroundColor: colors.bg },
        headerTintColor:  colors.textPrimary,
        headerTitleStyle: { fontFamily: font.mono, fontSize: 13, letterSpacing: 2 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="trades"
        options={{
          title: 'TRADES',
          tabBarIcon: ({ focused }) => <TabIcon label="📈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'NOTES',
          tabBarIcon: ({ focused }) => <TabIcon label="📝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'ALERTS',
          tabBarIcon: ({ focused }) => <TabIcon label="🔔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bank"
        options={{
          title: 'BANK',
          tabBarIcon: ({ focused }) => <TabIcon label="🏦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
