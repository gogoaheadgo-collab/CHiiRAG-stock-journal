import { useState } from 'react'
import { Tabs, Redirect, router, usePathname } from 'expo-router'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Modal, Alert,
} from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

const TABS = [
  { name: 'dashboard', label: 'Dashboard',  icon: '📊' },
  { name: 'trades',    label: 'All Trades',  icon: '📈' },
  { name: 'notes',     label: 'Notes',       icon: '📝' },
  { name: 'alerts',    label: 'Alerts',      icon: '🔔' },
  { name: 'bank',      label: 'Bank',        icon: '🏦' },
  { name: 'profile',   label: 'Profile',     icon: '👤' },
]

function Header() {
  const pathname        = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* App bar */}
      <View style={s.appBar}>
        <View style={s.appBarLeft}>
          <View style={s.flag}>
            <View style={[s.flagStripe, { backgroundColor: '#FF9933' }]} />
            <View style={[s.flagStripe, { backgroundColor: '#ffffff' }]} />
            <View style={[s.flagStripe, { backgroundColor: '#138808' }]} />
          </View>
          <View>
            <Text style={s.appName}>
              <Text style={{ color: colors.text }}>CHiiRAG </Text>
              <Text style={{ color: colors.accent }}>STOCK</Text>
            </Text>
            <Text style={s.appSub}>Journal</Text>
          </View>
        </View>
        <TouchableOpacity style={s.menuBtn} onPress={() => setMenuOpen(true)}>
          <View style={s.menuLine} />
          <View style={s.menuLine} />
          <View style={s.menuLine} />
        </TouchableOpacity>
      </View>

      {/* Horizontal pill nav */}
      <View style={s.pillBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillScroll}>
          {TABS.map(tab => {
            const active = pathname.includes(tab.name)
            return (
              <TouchableOpacity
                key={tab.name}
                style={[s.pill, active && s.pillActive]}
                onPress={() => router.push(`/(app)/${tab.name}` as any)}
              >
                <Text style={[s.pillText, active && s.pillTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Slide-out drawer */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.overlay}>
          {/* Backdrop tap-to-close */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuOpen(false)} />

          {/* Drawer panel (right side) */}
          <View style={s.drawer}>
            <View style={s.drawerHead}>
              <Text style={s.drawerBrand}>
                CHiiRAG <Text style={{ color: colors.accent }}>STOCK</Text>
              </Text>
              <Text style={s.drawerBrandSub}>Journal</Text>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {TABS.map(tab => {
                const active = pathname.includes(tab.name)
                return (
                  <TouchableOpacity
                    key={tab.name}
                    style={[s.drawerItem, active && s.drawerItemActive]}
                    onPress={() => { setMenuOpen(false); router.push(`/(app)/${tab.name}` as any) }}
                  >
                    <Text style={s.drawerIcon}>{tab.icon}</Text>
                    <Text style={[s.drawerLabel, active && s.drawerLabelActive]}>{tab.label}</Text>
                    {active ? <View style={s.drawerDot} /> : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.drawerSignOut}
              onPress={() =>
                Alert.alert('Sign Out', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: () => { setMenuOpen(false); supabase.auth.signOut() } },
                ])
              }
            >
              <Text style={s.drawerSignOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}

export default function AppLayout() {
  const { session, role, loading } = useAuth()

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )

  if (!session) return <Redirect href="/(auth)/login" />
  if (role === 'pending') return <Redirect href="/(auth)/pending" />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header />
      <Tabs
        screenOptions={{
          headerShown:  false,
          tabBarStyle:  { display: 'none' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="trades"    />
        <Tabs.Screen name="notes"     />
        <Tabs.Screen name="alerts"    />
        <Tabs.Screen name="bank"      />
        <Tabs.Screen name="profile"   />
      </Tabs>
    </View>
  )
}

const s = StyleSheet.create({
  // App bar
  appBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingTop:        Platform.OS === 'ios' ? 50 : 12,
    paddingBottom:     spacing.sm,
    backgroundColor:   colors.bg,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flag:       { width: 6, height: 32, borderRadius: 2, overflow: 'hidden' },
  flagStripe: { flex: 1 },
  appName:    { fontSize: font.size.lg, fontWeight: '800' },
  appSub:     { fontSize: font.size.xs, color: colors.muted, letterSpacing: 1 },

  // Hamburger button
  menuBtn:  { padding: spacing.sm, gap: 5 },
  menuLine: { width: 22, height: 2, backgroundColor: colors.text, borderRadius: 1 },

  // Pill nav
  pillBar:    { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  pillScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  pillActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText:       { fontSize: font.size.sm, fontWeight: '600', color: colors.muted },
  pillTextActive: { color: colors.white },

  // Drawer
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    width:           '72%',
    backgroundColor: colors.bg,
    paddingTop:      Platform.OS === 'ios' ? 60 : 52,
    paddingBottom:   spacing.xl,
    elevation:       12,
    shadowColor:     '#000',
    shadowOffset:    { width: -4, height: 0 },
    shadowOpacity:   0.25,
    shadowRadius:    16,
  },
  drawerHead: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom:      spacing.md,
  },
  drawerBrand:    { fontSize: font.size.xl, fontWeight: '800', color: colors.text },
  drawerBrandSub: { fontSize: font.size.xs, color: colors.muted, letterSpacing: 1, marginTop: 2 },
  drawerItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  drawerItemActive: { backgroundColor: colors.accentDim },
  drawerIcon:       { fontSize: 18 },
  drawerLabel:      { fontSize: font.size.md, color: colors.text, fontWeight: '500', flex: 1 },
  drawerLabelActive:{ color: colors.accent, fontWeight: '700' },
  drawerDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  drawerSignOut: {
    marginHorizontal: spacing.lg,
    paddingTop:       spacing.md,
    borderTopWidth:   1,
    borderTopColor:   colors.border,
    marginTop:        spacing.sm,
  },
  drawerSignOutText: { fontSize: font.size.md, fontWeight: '700', color: colors.red },
})
