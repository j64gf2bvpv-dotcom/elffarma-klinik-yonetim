import { contextBridge, ipcRenderer } from 'electron'

interface RecoveryPayload {
  access_token: string
  refresh_token: string
  type: string | null
}

interface GoogleServiceAccount {
  client_email: string
  private_key: string
}

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

// Whitelisted, narrow API exposed to the renderer. The renderer never gets
// direct Node/Electron access (contextIsolation: true, nodeIntegration: false).
contextBridge.exposeInMainWorld('electronAPI', {
  openWhatsApp: (waMeUrl: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:open-external', waMeUrl),
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('app:notify', title, body),
  onDeepLinkRecovery: (callback: (payload: RecoveryPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RecoveryPayload) => callback(payload)
    ipcRenderer.on('deep-link-recovery', listener)
    return () => ipcRenderer.removeListener('deep-link-recovery', listener)
  },
  // Google'ın servis hesabı JWT-Bearer akışı tarayıcıdan (CORS) çağrılamadığı
  // için ana süreçte (Node, CORS'a tabi değil) yürütülüyor — bkz. electron/googleDrive.ts.
  googleDriveUpload: (
    serviceAccount: GoogleServiceAccount,
    folderId: string,
    filename: string,
    jsonContent: string,
  ): Promise<{ id: string }> =>
    ipcRenderer.invoke('backup:google-drive-upload', serviceAccount, folderId, filename, jsonContent),
  googleDriveTestConnection: (
    serviceAccount: GoogleServiceAccount,
    folderId: string,
  ): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('backup:google-drive-test', serviceAccount, folderId),
  checkForUpdates: (): Promise<UpdaterCheckResult> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),
  onUpdaterEvent: (callback: (event: UpdaterEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdaterEvent) => callback(payload)
    ipcRenderer.on('updater:event', listener)
    return () => ipcRenderer.removeListener('updater:event', listener)
  },
})
