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
