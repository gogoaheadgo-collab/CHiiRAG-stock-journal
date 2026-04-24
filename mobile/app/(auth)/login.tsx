import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { signInWithEmail } from '../../lib/supabase'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>CHiiRAG</Text>
          <Text style={styles.subtitle}>STOCK JOURNAL</Text>
          <View style={styles.divider} />
        </View>

        {/* Form */}
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
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnText}>LOGIN →</Text>
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
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    fontFamily: font.mono,
    fontSize: font.size.h1,
    fontWeight: font.weight.black,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 6,
    marginTop: 4,
  },
  divider: {
    width: 40, height: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
    borderRadius: 1,
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  label: {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: font.mono,
    fontSize: font.size.md,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontFamily: font.mono,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.white,
    letterSpacing: 2,
  },
  footer: {
    textAlign: 'center',
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
})
