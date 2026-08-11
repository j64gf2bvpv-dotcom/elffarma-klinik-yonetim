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
    }
  }
}
