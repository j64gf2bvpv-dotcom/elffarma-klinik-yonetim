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
})
