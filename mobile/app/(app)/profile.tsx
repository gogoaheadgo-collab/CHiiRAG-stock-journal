import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../lib/supabase'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function ProfileScreen() {
  const { session, role } = useAuth()
  const user    = session?.user
  const email   = user?.email || ''
  const name    = user?.user_metadata?.full_name || email.split('@')[0]
  const isAdmin = email === 'gogoaheadgo@gmail.com'

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login') } }
    ])
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

      {/* Avatar */}
      <View style={s.avatarBlock}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{name}</Text>
        <Text style={s.email}>{email}</Text>
        {isAdmin && (
          <View style={s.adminBadge}><Text style={s.adminText}>ADMINISTRATOR</Text></View>
        )}
      </View>

      {/* Info */}
      <View style={s.card}>
        <Text style={s.cardTitle}>ACCOUNT INFO</Text>
        {[
          { label: 'Full Name', value: name },
          { label: 'Email',    value: email },
          { label: 'Role',     value: isAdmin ? 'Administrator' : 'Subscriber' },
          { label: 'Status',   value: role?.toUpperCase() || '—' },
          { label: 'App',      value: 'SMK Stock Journal v1.0' },
        ].map(row => (
          <View key={row.label} style={s.row}>
            <Text style={s.rowLabel}>{row.label}</Text>
            <Text style={s.rowValue} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.lg, paddingBottom: 120 },

  avatarBlock: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accentDim,
    borderWidth: 3, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: font.size.h1, fontWeight: '800', color: colors.accent },
  name:       { fontSize: font.size.xl, fontWeight: '700', color: colors.text },
  email:      { fontSize: font.size.md, color: colors.muted, marginTop: 4 },
  adminBadge: { marginTop: spacing.sm, backgroundColor: colors.accentDim, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  adminText:  { fontSize: font.size.sm, color: colors.accent2, fontWeight: '700', letterSpacing: 1 },

  card:      { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  cardTitle: { fontSize: font.size.sm, color: colors.muted, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.md },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:  { fontSize: font.size.md, color: colors.muted },
  rowValue:  { fontSize: font.size.md, color: colors.text, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  signOutBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  signOutText:{ fontSize: font.size.lg, fontWeight: '600', color: colors.text },
})
