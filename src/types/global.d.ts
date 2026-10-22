export {}

declare global {
  const __APP_VERSION__: string

  type UpdaterEvent =
    | { type: 'checking' }
    | { type: 'available'; version: string }
    | { type: 'not-available'; version: string }
    | { type: 'progress'; percent: number }
    | { type: 'downloaded'; version: string }
    | { type: 'error'; message: string }

  interface UpdaterCheckResult {
    ok: boolean
    reason?: 'not-packaged' | 'error'
    message?: string
  }

  interface Window {
    electronAPI?: {
      openWhatsApp: (waMeUrl: string) => Promise<boolean>
      /** https görsel adresini (CORS'suz siteler dahil) data: URL olarak indirir — fiyat listesi PDF'i için */
      fetchImageDataUrl?: (url: string) => Promise<string | null>
      /** İşletim sisteminin yazı tanıması (macOS Vision / Windows OCR) — satırlar, kutular 0-1 oranında, y alttan */
      nativeOcr?: {
        (dataUrl: string): Promise<{ t: string; c?: number; x: number; y: number; w: number; h: number }[] | null>
        (dataUrls: string[]): Promise<{ t: string; c?: number; x: number; y: number; w: number; h: number }[][] | null>
      }
      /** Instagram yeni paylaşım bildirimi — programın içinde ayrı oturumla giriş + son paylaşımlar */
      instagramLogin?: () => Promise<boolean>
      instagramStatus?: () => Promise<{ loggedIn: boolean }>
      instagramRecentPosts?: (username: string) => Promise<{
        posts?: { id: string; shortcode: string; takenAt: number; isVideo: boolean; caption: string; thumbnail: string }[]
        error?: string
      }>
      /** Kongre web sitesinden bilgi çekmek için HTML (ana süreç üzerinden, CORS'suz) */
      fetchPageHtml?: (url: string) => Promise<{ url: string; html: string } | null>
      openNetworkSettings: () => Promise<void>
      notify: (title: string, body: string) => Promise<void>
      onDeepLinkRecovery?: (
        callback: (payload: { access_token: string; refresh_token: string; type: string | null }) => void,
      ) => () => void
      googleDriveUpload: (
        serviceAccount: { client_email: string; private_key: string },
        folderId: string,
        filename: string,
        jsonContent: string,
      ) => Promise<{ id: string }>
      googleDriveTestConnection: (
        serviceAccount: { client_email: string; private_key: string },
        folderId: string,
      ) => Promise<{ ok: boolean; message: string }>
      checkForUpdates: () => Promise<UpdaterCheckResult>
      installUpdate: () => Promise<void>
      onUpdaterEvent?: (callback: (event: UpdaterEvent) => void) => () => void
    }
  }
}
