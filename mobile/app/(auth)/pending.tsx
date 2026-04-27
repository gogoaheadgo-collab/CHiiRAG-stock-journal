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
    <View style={s.container}>
      <View style={s.inner}>
        <Text style={s.icon}>⏳</Text>
        <Text style={s.title}>AWAITING APPROVAL</Text>
        <Text style={s.subtitle}>
          Your access request has been submitted.{'\n'}
          The admin will approve your account shortly.
        </Text>

        <View style={s.card}>
          <Text style={s.cardText}>
            Once approved, tap the button below to check your status and gain access.
          </Text>
        </View>

        <TouchableOpacity style={s.checkBtn} onPress={handleCheck} disabled={checking}>
          {checking
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={s.checkBtnText}>CHECK STATUS</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  inner:     { paddingHorizontal: spacing.xl, alignItems: 'center' },
  icon:      { fontSize: 48, marginBottom: spacing.lg },
  title: {
    fontSize: font.size.lg, fontWeight: font.weight.bold,
    color: colors.text, letterSpacing: 2,
    marginBottom: spacing.md, textAlign: 'center',
  },
  subtitle: {
    fontSize: font.size.md, color: colors.muted,
    textAlign: 'center', lineHeight: 22,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl, width: '100%',
  },
  cardText: { fontSize: font.size.md, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  checkBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center',
    width: '100%', marginBottom: spacing.md,
  },
  checkBtnText: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.white, letterSpacing: 1 },
  signOutBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', width: '100%',
  },
  signOutText: { fontSize: font.size.md, color: colors.muted },
})
