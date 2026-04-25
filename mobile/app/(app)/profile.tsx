import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../lib/supabase'
import { colors, font, spacing, radius, shadow } from '../../lib/theme'

export default function ProfileScreen() {
  const { session, role } = useAuth()
  const user  = session?.user
  const email = user?.email || ''
  const name  = user?.user_metadata?.full_name || email.split('@')[0]
  const isAdmin = email === 'gogoaheadgo@gmail.com'
  const initial = name.charAt(0).toUpperCase()

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login') }
      }
    ])
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>

      {/* Avatar */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        {isAdmin && (
          <View style={styles.adminBadge}><Text style={styles.adminText}>ADMIN</Text></View>
        )}
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ACCOUNT</Text>
        <Row label="EMAIL"  value={email} />
        <Row label="ROLE"   value={isAdmin ? 'Administrator' : 'Subscriber'} />
        <Row label="STATUS" value={role?.toUpperCase() || '—'} />
        <Row label="APP"    value="SMK Stock Journal v1.0" />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  avatarBlock: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentDim,
    borderWidth: 2, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md, ...shadow.sm,
  },
  avatarText: { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.h1, fontWeight: '700', color: colors.accent },
  name:       { fontFamily: 'LibreBaskervilleBold', fontSize: font.size.xl, fontWeight: '700', color: colors.text },
  email:      { fontFamily: 'DMmono', fontSize: font.size.sm, color: colors.muted, marginTop: 4 },
  adminBadge: {
    marginTop: spacing.sm, backgroundColor: colors.accentDim,
    paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1, borderColor: '#bae6fd',
  },
  adminText:  { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.accent2, fontWeight: '700', letterSpacing: 1 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm,
  },
  cardTitle: {
    fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted,
    letterSpacing: 2, marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontFamily: 'DMmono', fontSize: font.size.xs, color: colors.muted, letterSpacing: 0.5 },
  rowValue: { fontFamily: 'LibreBaskerville', fontSize: font.size.md, color: colors.text, maxWidth: '60%', textAlign: 'right' },

  signOutBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  signOutText: { fontFamily: 'LibreBaskerville', fontSize: font.size.lg, color: colors.text },
})
