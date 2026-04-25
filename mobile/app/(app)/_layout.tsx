import { Tabs, Redirect } from 'expo-router'
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing } from '../../lib/theme'

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
        // ── Tab Bar ──────────────────────────────────────────────────────────
        tabBarStyle: {
          backgroundColor:  colors.bg,
          borderTopColor:   colors.border,
          borderTopWidth:   1,
          height:           Platform.OS === 'ios' ? 84 : 64,
          paddingBottom:    Platform.OS === 'ios' ? 24 : 8,
          paddingTop:       8,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize:      font.size.xs,
          fontWeight:    '600',
          letterSpacing: 0.3,
          marginTop:     2,
        },

        // ── Header ───────────────────────────────────────────────────────────
        headerStyle: {
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        } as any,
        headerTintColor:    colors.text,
        headerTitleStyle: {
          fontSize:   font.size.lg,
          fontWeight: font.weight.bold,
          color:      colors.text,
        },
        headerShadowVisible: false,
        headerTitleAlign:    'center',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title:       'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title:       'Trades',
          tabBarLabel: 'Trades',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title:       'Notes',
          tabBarLabel: 'Notes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title:       'Alerts',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="bank"
        options={{
          title:       'Bank',
          tabBarLabel: 'Bank',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏦</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title:       'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
})
