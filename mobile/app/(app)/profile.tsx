import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../lib/supabase'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function ProfileScreen() {
  const { session, role } = useAuth()
  const user = session?.user
  const email = user?.email || ''
  const name  = user?.user_metadata?.full_name || email.split('@')[0]
  const isAdmin = email === 'gogoaheadgo@gmail.com'

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>

      {/* Avatar block */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        {isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminText}>ADMIN</Text>
          </View>
        )}
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <Row label="EMAIL"  value={email} />
        <Row label="ROLE"   value={isAdmin ? 'Admin' : 'Subscriber'} />
        <Row label="STATUS" value={role?.toUpperCase() || '—'} />
        <Row label="APP"    value="SMK Stock Journal v1.0" />
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  avatarBlock:  { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent + '33',
    borderWidth: 2, borderColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText:  { fontFamily: font.mono, fontSize: font.size.xxl, fontWeight: font.weight.black, color: colors.accent },
  name:        { fontFamily: font.mono, fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.textPrimary },
  email:       { fontFamily: font.mono, fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },
  adminBadge:  { marginTop: spacing.sm, backgroundColor: colors.accent + '22', paddingHorizontal: 12, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent + '44' },
  adminText:   { fontFamily: font.mono, fontSize: font.size.xs, color: colors.accent, letterSpacing: 2 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  sectionTitle: { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 3, marginBottom: spacing.md },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:    { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textMuted, letterSpacing: 1 },
  rowValue:    { fontFamily: font.mono, fontSize: font.size.xs, color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },
  signOutBtn: {
    backgroundColor: colors.red + '18', borderWidth: 1, borderColor: colors.red + '44',
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
  },
  signOutText: { fontFamily: font.mono, fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.red, letterSpacing: 2 },
})
