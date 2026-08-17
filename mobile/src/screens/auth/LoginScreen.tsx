import * as React from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured, CLINIC_NAME } from '@/lib/supabaseClient'
import { useTheme } from '@/lib/ThemeContext'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'

/**
 * Masaüstündeki LoginPage.tsx'in mobil karşılığı — aynı alanlar (e-posta/
 * şifre), aynı hata mesajı eşlemesi (auth.tsx'ten geliyor, ayrıca burada
 * çevrilmiyor), "Şifremi Unuttum" aynı şekilde ayrı bir route değil, mod
 * değişimi. "Beni Hatırla" native'de yok (bkz. plan §Context — oturum her
 * zaman kalıcı, kullanıcı sadece "Çıkış Yap" ile sonlandırır).
 *
 * Kullanıcı isteğiyle (2026-08-16) "çok basit duruyor, profesyonel olsun"
 * — koyu, marka renginde bir üst blok (logo + giriş yapılan uygulamanın
 * ismi) + üzerine binen yuvarlak köşeli açık form kartı, react-native-
 * reanimated ile ikisi de kendi yönünden (üst blok yukarıdan, form kartı
 * aşağıdan) hafif gecikmeli girer. Logo, kullanıcının sağladığı gerçek
 * marka görseli — 2026-08-17'de arka planı şeffaflaştırılmış hâliyle
 * (assets/logo-transparent.png, sadece beyaz yazı) değiştirildi; "Estetik
 * Sanatı" alt başlığı görselin kendi içinde olduğu için ayrı bir Text'e
 * gerek kalmadı, beyaz kutu da kaldırıldı — logo doğrudan hero zemininde.
 */
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
      style={{ flex: 1, backgroundColor: theme.colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(650).springify().damping(16)} style={styles.hero}>
          <Image source={require('../../../assets/logo-transparent.png')} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(650).delay(150).springify().damping(16)}
          style={[styles.card, { backgroundColor: theme.colors.card, shadowColor: '#000' }]}
        >
          <Text style={[styles.appName, { color: theme.colors.foreground }]}>{CLINIC_NAME}</Text>
          <Text style={{ color: theme.colors.mutedForeground, marginBottom: 22 }}>
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
              <Button onPress={handleSignIn} loading={submitting} disabled={!email || !password} size="lg">
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
                  <Button onPress={handleForgotPassword} loading={submitting} disabled={!email} size="lg">
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
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 84, paddingBottom: 64, paddingHorizontal: 24 },
  logoImage: { width: 260, height: 60 },
  card: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  appName: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  warning: { marginBottom: 16 },
})
