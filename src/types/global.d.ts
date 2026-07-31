export {}

declare global {
  interface Window {
    electronAPI?: {
      openWhatsApp: (waMeUrl: string) => Promise<boolean>
      notify: (title: string, body: string) => Promise<void>
      onDeepLinkRecovery?: (
        callback: (payload: { access_token: string; refresh_token: string; type: string | null }) => void,
      ) => () => void
      saveCredentials: (email: string, password: string) => Promise<boolean>
      loadCredentials: () => Promise<{ email: string; password: string } | null>
      clearCredentials: () => Promise<boolean>
    }
  }
}
