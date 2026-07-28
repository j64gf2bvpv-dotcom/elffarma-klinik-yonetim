import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil. ' +
      '.env dosyasını README talimatlarına göre doldurun.',
  )
}

const REMEMBER_ME_KEY = 'klinik-remember-me'
const REMEMBERED_EMAIL_KEY = 'klinik-remembered-email'

// "Beni Hatırla" işaretliyse oturum kalıcı olarak (localStorage) saklanır ve
// uygulama yeniden açıldığında otomatik giriş yapılır; işaretli değilse oturum
// yalnızca sessionStorage'da tutulur, yani uygulama kapatılınca oturum sona erer.
export function isRememberMeEnabled(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) !== 'false'
}

export function setRememberMe(remember: boolean) {
  localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false')
}

export function getRememberedEmail(): string {
  return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ''
}

export function setRememberedEmail(email: string) {
  if (email) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
  } else {
    localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  }
}

const authStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (isRememberMeEnabled()) {
      localStorage.setItem(key, value)
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, value)
      localStorage.removeItem(key)
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: authStorage,
    },
  },
)

export const CLINIC_NAME = (import.meta.env.VITE_CLINIC_NAME as string | undefined) || 'Klinik Yönetim'
