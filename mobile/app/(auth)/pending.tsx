import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { signOut } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function PendingScreen() {
  const { refresh } = useAuth()
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    setChecking(true)
    refresh()
    setTimeout(() => setChecking(false), 2000)
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>AWAITING APPROVAL</Text>
        <Text style={styles.subtitle}>
          Your access request has been submitted.{'\n'}
          The admin will approve your account shortly.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            Once approved, tap the button below to check your status and gain access.
          </Text>
        </View>

        <TouchableOpacity style={styles.checkBtn} onPress={handleCheck} disabled={checking}>
          {checking
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={styles.checkBtnText}>CHECK STATUS →</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  inner:     { paddingHorizontal: spacing.xl, alignItems: 'center' },
  icon:      { fontSize: 48, marginBottom: spacing.lg },
  title: {
    fontFamily: font.mono, fontSize: font.size.lg,
    fontWeight: font.weight.black, color: colors.textPrimary,
    letterSpacing: 3, marginBottom: spacing.md, textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.mono, fontSize: font.size.sm,
    color: colors.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl, width: '100%',
  },
  cardText: { fontFamily: font.mono, fontSize: font.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  checkBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', width: '100%', marginBottom: spacing.md,
  },
  checkBtnText: { fontFamily: font.mono, fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.white, letterSpacing: 2 },
  signOutBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', width: '100%',
  },
  signOutText: { fontFamily: font.mono, fontSize: font.size.sm, color: colors.textMuted, letterSpacing: 1 },
})
