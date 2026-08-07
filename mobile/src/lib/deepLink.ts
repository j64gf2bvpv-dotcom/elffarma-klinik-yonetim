import * as React from 'react'
import * as Linking from 'expo-linking'

export interface RecoveryTokens {
  access_token: string
  refresh_token: string
}

/**
 * Masaüstündeki electron/main.ts'in open-url/second-instance/argv üzerinden
 * ayrıştırıp preload IPC'siyle renderer'a ilettiği
 * `elffarmapaket://reset#access_token=...&refresh_token=...&type=recovery`
 * linkini burada Expo'nun Linking API'siyle (native taşıma katmanı farklı,
 * ayrıştırma mantığı aynı) yakalayıp token'ları çıkarır.
 */
export function parseRecoveryUrl(url: string): RecoveryTokens | null {
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return null
  const params = new URLSearchParams(url.slice(hashIndex + 1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

/** `onRecovery` yakalanan her geçerli şifre-sıfırlama linkinde çağrılır. */
export function useDeepLinkRecovery(onRecovery: (tokens: RecoveryTokens) => void) {
  const handlerRef = React.useRef(onRecovery)
  handlerRef.current = onRecovery

  React.useEffect(() => {
    function handleUrl(url: string) {
      const tokens = parseRecoveryUrl(url)
      if (tokens) handlerRef.current(tokens)
    }

    // Soğuk başlangıç: uygulama linkle AÇILMIŞSA.
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url)
    })

    // Sıcak başlangıç: uygulama zaten açıkken linke tıklanmışsa.
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => subscription.remove()
  }, [])
}
