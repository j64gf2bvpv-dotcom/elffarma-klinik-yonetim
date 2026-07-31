import { contextBridge, ipcRenderer } from 'electron'

interface RecoveryPayload {
  access_token: string
  refresh_token: string
  type: string | null
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
  saveCredentials: (email: string, password: string): Promise<boolean> =>
    ipcRenderer.invoke('credentials:save', email, password),
  loadCredentials: (): Promise<{ email: string; password: string } | null> =>
    ipcRenderer.invoke('credentials:load'),
  clearCredentials: (): Promise<boolean> => ipcRenderer.invoke('credentials:clear'),
})
