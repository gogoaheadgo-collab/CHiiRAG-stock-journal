import { useState } from 'react'
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { signInWithGoogle } from '../../lib/supabase'
import { colors, font, spacing, radius } from '../../lib/theme'

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result?.type === 'success') {
        router.replace('/(app)/trades')
      }
    } catch (e: any) {
      Alert.alert('Sign-In Failed', e.message || 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>SMK</Text>
          <Text style={styles.subtitle}>STOCK JOURNAL</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Track · Analyse · Grow</Text>
        </View>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleGoogle}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : (
            <View style={styles.googleBtnInner}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>CONTINUE WITH GOOGLE</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Use the same Google account{'\n'}as the web app
        </Text>

        <Text style={styles.footer}>SMK Stock Journal · v1.0</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },

  // Header
  header:   { alignItems: 'center', marginBottom: spacing.xxl * 1.5 },
  logo: {
    fontSize: font.size.h1,
    fontWeight: font.weight.black,
    color: colors.textPrimary,
    letterSpacing: 6,
  },
  subtitle: {
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
  tagline: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: spacing.md,
  },

  // Google button
  googleBtn: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accent + '66',
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  googleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: font.weight.black,
    color: colors.accent,
  },
  googleBtnText: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  btnDisabled: { opacity: 0.6 },

  hint: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.xxl,
  },
  footer: {
    position: 'absolute',
    bottom: -120,
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 1,
  },
})
