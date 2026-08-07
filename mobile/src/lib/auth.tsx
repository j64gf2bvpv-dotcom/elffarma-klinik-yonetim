import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import type { Staff } from '@shared/types/database'

interface AuthContextValue {
  session: Session | null
  staff: Staff | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

// Masaüstündeki aynı deep-link — bkz. mobile/src/lib/deepLink.ts (Linking
// tabanlı alıcı taraf, Electron IPC'nin yerini alıyor).
const DEEP_LINK_RESET_URL = 'elffarmapaket://reset'

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [staff, setStaff] = React.useState<Staff | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadStaffProfile = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('staff').select('*').eq('id', userId).single()
    if (error) {
      console.error('[Auth] Personel profili alınamadı:', error.message)
      setStaff(null)
      return
    }
    setStaff(data as Staff)
  }, [])

  React.useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      if (data.session?.user) {
        loadStaffProfile(data.session.user.id).finally(() => isMounted && setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        loadStaffProfile(newSession.user.id)
      } else {
        setStaff(null)
      }
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [loadStaffProfile])

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'E-posta veya şifre hatalı.' }
      }
      return { error: error.message }
    }
    return { error: null }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const sendPasswordReset = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: DEEP_LINK_RESET_URL,
    })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  const updatePassword = React.useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  const value = React.useMemo(
    () => ({ session, staff, loading, signIn, signOut, sendPasswordReset, updatePassword }),
    [session, staff, loading, signIn, signOut, sendPasswordReset, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
