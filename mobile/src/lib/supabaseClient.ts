import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// process.env.EXPO_PUBLIC_* Metro'nun statik inline transformuyla native'de
// güvenilir çalışıyor ama web hedefinde çalışma zamanında undefined
// kalabiliyor (SDK 57'de gözlemlendi, 2026-08-16) — app.config.js'in
// `extra` alanına yazılan kopya, expo-constants üzerinden HER platformda
// (native + web) tutarlı okunuyor, bu yüzden yedek olarak kullanılıyor.
const extra = Constants.expoConfig?.extra ?? {}
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? (extra.supabaseUrl as string | null)
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (extra.supabaseAnonKey as string | null)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. ' +
      'mobile/.env dosyasını mobile/.env.example talimatlarına göre doldurun.',
  )
}

// Masaüstündeki "Beni Hatırla" (localStorage/sessionStorage geçişi) yerine —
// native uygulamalarda "sekmeyi kapatma" kavramı yok, oturum açık kaldığı
// sürece kalıcıdır (bkz. plan §Context, "Remember me" bilinçli sapma notu).
// Supabase'in kendi önerdiği kalıcı depo AsyncStorage'dır (expo-secure-store
// 2048 byte sınırı yüzünden bir oturum JWT+refresh-token blob'unu kesebilir).
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: AsyncStorage,
      detectSessionInUrl: false,
    },
  },
)

export const CLINIC_NAME = process.env.EXPO_PUBLIC_CLINIC_NAME || (extra.clinicName as string | undefined) || 'Elffarma Paket Programı'
