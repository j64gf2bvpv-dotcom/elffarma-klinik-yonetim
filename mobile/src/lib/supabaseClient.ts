import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

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

export const CLINIC_NAME = process.env.EXPO_PUBLIC_CLINIC_NAME || 'Elffarma Paket Programı'
