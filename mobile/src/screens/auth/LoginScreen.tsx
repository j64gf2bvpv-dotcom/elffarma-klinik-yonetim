import * as React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LogIn } from 'lucide-react-native'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured, CLINIC_NAME } from '@/lib/supabaseClient'
import { useTheme } from '@/lib/ThemeContext'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'

/** Masaüstündeki LoginPage.tsx'in mobil karşılığı — aynı alanlar (e-posta/
 * şifre), aynı hata mesajı eşlemesi (auth.tsx'ten geliyor, ayrıca burada
 * çevrilmiyor), "Şifremi Unuttum" aynı şekilde ayrı bir route değil, mod
 * değişimi. "Beni Hatırla" native'de yok (bkz. plan §Context — oturum her
 * zaman kalıcı, kullanıcı sadece "Çıkış Yap" ile sonlandırır). */
export function LoginScreen() {
  const { signIn, sendPasswordReset } = useAuth()
  const theme = useTheme()

  const [mode, setMode] = React.useState<'signin' | 'forgot'>('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [resetSent, setResetSent] = React.useState(false)

  async function handleSignIn() {
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) setError(error)
  }

  async function handleForgotPassword() {
    setError(null)
    setSubmitting(true)
    const { error } = await sendPasswordReset(email.trim())
    setSubmitting(false)
    if (error) setError(error)
    else setResetSent(true)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.iconBox, { backgroundColor: theme.colors.primary }]}>
          <LogIn color={theme.colors.primaryForeground} size={28} />
        </View>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{CLINIC_NAME}</Text>
        <Text style={{ color: theme.colors.mutedForeground, marginBottom: 24 }}>
          {mode === 'signin' ? 'Devam etmek için giriş yapın' : 'Şifrenizi mi unuttunuz?'}
        </Text>

        {!isSupabaseConfigured && (
          <Text style={[styles.warning, { color: theme.colors.warning }]}>
            Supabase yapılandırması eksik — mobile/.env dosyasını kontrol edin.
          </Text>
        )}

        {mode === 'signin' ? (
          <View style={{ gap: 14 }}>
            <TextField
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <TextField
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {error && <Text style={{ color: theme.colors.destructive }}>{error}</Text>}
            <Button onPress={handleSignIn} loading={submitting} disabled={!email || !password}>
              Giriş Yap
            </Button>
            <Button variant="ghost" onPress={() => setMode('forgot')}>
              Şifremi Unuttum
            </Button>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {resetSent ? (
              <Text style={{ color: theme.colors.success }}>
                Şifre sıfırlama bağlantısı e-postanıza gönderildi.
              </Text>
            ) : (
              <>
                <TextField
                  label="E-posta"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
                {error && <Text style={{ color: theme.colors.destructive }}>{error}</Text>}
                <Button onPress={handleForgotPassword} loading={submitting} disabled={!email}>
                  Sıfırlama Bağlantısı Gönder
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onPress={() => {
                setMode('signin')
                setResetSent(false)
                setError(null)
              }}
            >
              Girişe Dön
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  warning: { marginBottom: 16 },
})
