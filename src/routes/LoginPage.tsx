import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import {
  isSupabaseConfigured,
  getRememberedEmail,
  setRememberedEmail,
  isRememberMeEnabled,
  setRememberMe,
} from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { ElffarmaLogo } from '@/components/brand/ElffarmaLogo'

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await sendPasswordReset(email)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <p className="text-center text-sm text-success">
          <strong>{email}</strong> adresine bir şifre sıfırlama bağlantısı gönderdik. Gelen kutunuzu kontrol edin.
        </p>
        <Button type="button" variant="outline" onClick={onBack}>
          Girişe Dön
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="reset-email">E-posta</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting && <Loader2 className="animate-spin" />}
        Sıfırlama Bağlantısı Gönder
      </Button>
      <Button type="button" variant="ghost" onClick={onBack}>
        Girişe Dön
      </Button>
    </form>
  )
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = React.useState(() => getRememberedEmail())
  const [password, setPassword] = React.useState('')
  const [rememberMe, setRememberMeState] = React.useState(() => isRememberMeEnabled())
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [mode, setMode] = React.useState<'signin' | 'forgot'>('signin')

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setRememberMe(rememberMe)
    setRememberedEmail(rememberMe ? email : '')
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        <div className="flex flex-col items-center gap-2 bg-primary px-6 py-10">
          <ElffarmaLogo size="lg" tagline variant="onRed" />
        </div>
        <CardContent className="pt-6">
          <CardDescription className="mb-4 text-center">
            {mode === 'signin' ? 'Devam etmek için giriş yapın' : 'Şifrenizi mi unuttunuz?'}
          </CardDescription>
          {!isSupabaseConfigured && (
            <p className="mb-4 rounded-md bg-warning/20 p-3 text-xs text-warning-foreground">
              Supabase bağlantısı yapılandırılmamış. Lütfen <code>.env</code> dosyasındaki
              <code> VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code> değerlerini
              girin (README'ye bakın).
            </p>
          )}
          {mode === 'forgot' ? (
            <ForgotPasswordForm onBack={() => setMode('signin')} />
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Şifre</Label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-primary hover:underline"
                  >
                    Şifremi Unuttum
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMeState(v === true)}
                />
                Beni hatırla (otomatik giriş için kaydet)
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting && <Loader2 className="animate-spin" />}
                Giriş Yap
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
