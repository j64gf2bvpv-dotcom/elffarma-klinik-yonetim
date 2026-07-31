export {}

declare global {
  const __APP_VERSION__: string

  interface Window {
    electronAPI?: {
      openWhatsApp: (waMeUrl: string) => Promise<boolean>
      notify: (title: string, body: string) => Promise<void>
      onDeepLinkRecovery?: (
        callback: (payload: { access_token: string; refresh_token: string; type: string | null }) => void,
      ) => () => void
    }
  }
}
