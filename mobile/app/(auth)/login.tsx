import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { signInWithEmail, signInWithGoogle } from '../../lib/supabase'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [gLoading, setGLoading] = useState(false)

  // ── Email / password login ─────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Enter email and password')
      return
    }
    setLoading(true)
    try {
      await signInWithEmail(email.trim().toLowerCase(), password)
      router.replace('/(app)/trades')
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Check your credentials')
    } finally {
      setLoading(false)
    }
  }

  // ── Google login ───────────────────────────────────────────────────────
  async function handleGoogle() {
    setGLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result.type === 'success') {
        router.replace('/(app)/trades')
      }
      // result.type === 'cancel' means user closed the browser — do nothing
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e.message || 'Please try again')
    } finally {
      setGLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>CHiiRAG</Text>
          <Text style={styles.subtitle}>STOCK JOURNAL</Text>
          <View style={styles.divider} />
        </View>

        {/* Google button */}
        <TouchableOpacity
          style={[styles.googleBtn, gLoading && styles.btnDisabled]}
          onPress={handleGoogle}
          disabled={gLoading || loading}
        >
          {gLoading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <View style={styles.googleBtnInner}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>CONTINUE WITH GOOGLE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        {/* Email / password form */}
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: spacing.lg }]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading || gLoading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.loginBtnText}>LOGIN →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>SMK Stock Journal · v1.0</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Header
  header:   { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    fontFamily: font.mono, fontSize: font.size.h1,
    fontWeight: font.weight.black, color: colors.textPrimary, letterSpacing: 4,
  },
  subtitle: {
    fontFamily: font.mono, fontSize: font.size.xs,
    color: colors.textMuted, letterSpacing: 6, marginTop: 4,
  },
  divider: {
    width: 40, height: 2, backgroundColor: colors.accent,
    marginTop: spacing.lg, borderRadius: 1,
  },

  // Google button
  googleBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  googleIcon: {
    fontFamily: font.mono, fontSize: font.size.lg,
    fontWeight: font.weight.black, color: colors.accent,
  },
  googleBtnText: {
    fontFamily: font.mono, fontSize: font.size.sm,
    fontWeight: font.weight.bold, color: colors.textPrimary, letterSpacing: 2,
  },

  // OR divider
  orRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  orLine:  { flex: 1, height: 1, backgroundColor: colors.border },
  orText: {
    fontFamily: font.mono, fontSize: font.size.xs,
    color: colors.textMuted, marginHorizontal: spacing.md, letterSpacing: 2,
  },

  // Email form
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.xl,
  },
  label: {
    fontFamily: font.mono, fontSize: font.size.xs,
    color: colors.textMuted, letterSpacing: 2, marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, color: colors.textPrimary,
    fontFamily: font.mono, fontSize: font.size.md,
  },
  loginBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.xl,
  },
  loginBtnText: {
    fontFamily: font.mono, fontSize: font.size.md,
    fontWeight: font.weight.bold, color: colors.white, letterSpacing: 2,
  },

  btnDisabled: { opacity: 0.6 },
  footer: {
    textAlign: 'center', fontFamily: font.mono,
    fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.xxl,
  },
})
