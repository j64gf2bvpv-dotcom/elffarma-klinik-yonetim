import * as React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/ThemeContext'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import type { RootStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>

/** Masaüstündeki ResetPasswordPage.tsx'in mobil karşılığı — buraya
 * navigasyon deepLink.ts'in yakaladığı recovery token'larıyla
 * supabase.auth.setSession() çağrıldıktan SONRA yapılır (bkz.
 * RootNavigator.tsx), aynı desteste. */
export function ResetPasswordScreen({ navigation }: Props) {
  const { updatePassword } = useAuth()
  const theme = useTheme()

  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  async function handleSubmit() {
    setError(null)
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.')
      return
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
    // RootNavigator.tsx: setSession() zaten session'ı doldurmuştu (deep-link
    // handler'da) — burada Main'e geçmek sadece navigasyonu tamamlıyor,
    // "geri" değil (ResetPassword deep-link'ten açılmışsa stack'te geri
    // gidilecek bir ekran olmayabilir).
    setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }), 1500)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.colors.foreground }]}>Yeni Şifre Belirle</Text>
        {done ? (
          <Text style={{ color: theme.colors.success }}>Şifreniz güncellendi, yönlendiriliyorsunuz...</Text>
        ) : (
          <>
            <TextField label="Yeni Şifre" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <TextField label="Yeni Şifre (Tekrar)" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            {error && <Text style={{ color: theme.colors.destructive }}>{error}</Text>}
            <Button onPress={handleSubmit} loading={submitting} disabled={!password || !confirm}>
              Şifreyi Güncelle
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
})
