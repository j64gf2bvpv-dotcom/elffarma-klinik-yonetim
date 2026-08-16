import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// KÖK SEBEP (2026-08-16, SDK 57, sadece web hedefi): Expo CLI'nin web
// geliştirme paketine gömdüğü "HMR env vars" enjeksiyonu
// (process.env = Object.defineProperties(...)) EXPO_PUBLIC_SUPABASE_URL
// değerindeki "https" önekini siliyor — sonuç "://xxx.supabase.co" gibi
// geçersiz bir URL oluyor (doğrulandı: derlenen pakette bu şekilde
// görüldü). Bu bozulma process.env'i "tanımsız" değil "yanlış ama dolu"
// bıraktığı için ?? ile basit bir fallback işe yaramıyor — bu yüzden
// app.config.js'in `extra` alanından (Node/CLI seviyesinde bir kere
// hesaplanıp expo-constants ile HİÇBİR platformda bu bozulmaya uğramadan
// okunan) gelen kopya BİLEREK ÖNCELİKLİ, process.env ikincil sırada.
const extra = Constants.expoConfig?.extra ?? {}
const supabaseUrl = (extra.supabaseUrl as string | null) ?? process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = (extra.supabaseAnonKey as string | null) ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

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

export const CLINIC_NAME = (extra.clinicName as string | undefined) || process.env.EXPO_PUBLIC_CLINIC_NAME || 'Elffarma Paket Programı'
