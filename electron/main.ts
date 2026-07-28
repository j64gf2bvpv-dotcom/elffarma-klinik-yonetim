import { app, BrowserWindow, Menu, shell, Notification, ipcMain } from 'electron'
import path from 'node:path'

process.env.APP_ROOT = path.join(__dirname, '..')
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

const DEEP_LINK_PROTOCOL = 'elffarmapaket'

let win: BrowserWindow | null = null

// Şifre sıfırlama e-postasındaki bağlantı (elffarmapaket://reset#access_token=...&refresh_token=...)
// tıklanınca işletim sistemi bu uygulamayı bu URL ile açar; burada token'ları ayıklayıp
// renderer'a IPC ile gönderiyoruz (React Router'ın kendi hash tabanlı yönlendirmesiyle
// çakışmaması için URL'yi renderer'a olduğu gibi değil, ayrıştırılmış halde iletiyoruz).
function handleDeepLink(url: string) {
  if (!url.startsWith(`${DEEP_LINK_PROTOCOL}://`)) return
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return
  const params = new URLSearchParams(url.slice(hashIndex + 1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  const type = params.get('type')
  if (!access_token || !refresh_token) return
  win?.webContents.send('deep-link-recovery', { access_token, refresh_token, type })
  win?.show()
  win?.focus()
}

function createWindow() {
  win = new BrowserWindow({
    title: 'Elffarma Paket Programı',
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    icon: path.join(process.env.VITE_PUBLIC!, 'app-icon.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => {
    win?.show()
  })

  // Any attempt to navigate to or open an external URL from the renderer
  // (e.g. a wa.me link accidentally triggered via <a target=_blank>) is
  // handed to the OS default handler instead of opening inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Elffarma Paket Programı',
      submenu: [
        { role: 'about', label: 'Elffarma Paket Programı Hakkında' },
        { type: 'separator' },
        { role: 'quit', label: 'Çıkış' },
      ],
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo', label: 'Geri Al' },
        { role: 'redo', label: 'Yinele' },
        { type: 'separator' },
        { role: 'cut', label: 'Kes' },
        { role: 'copy', label: 'Kopyala' },
        { role: 'paste', label: 'Yapıştır' },
        { role: 'selectAll', label: 'Tümünü Seç' },
      ],
    },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'reload', label: 'Yenile' },
        { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Yakınlaştırmayı Sıfırla' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam Ekran' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Narrow IPC surface used by the renderer's preload bridge.
ipcMain.handle('shell:open-external', (_event, url: string) => {
  if (typeof url === 'string' && /^https:\/\/wa\.me\//.test(url)) {
    shell.openExternal(url)
    return true
  }
  return false
})

ipcMain.handle('app:notify', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// macOS: uygulama zaten açıkken elffarmapaket:// bağlantısına tıklanırsa buradan gelir.
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

if (process.platform === 'win32' || process.platform === 'linux') {
  app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)
} else {
  app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  // Windows/Linux: elffarmapaket:// bağlantısına tıklanınca yeni bir kopya açılmaya çalışılır;
  // bunu engelleyip URL'yi zaten çalışan pencereye yönlendiriyoruz.
  app.on('second-instance', (_event, argv) => {
    const deepLinkArg = argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`))
    if (deepLinkArg) handleDeepLink(deepLinkArg)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    // Windows: uygulama elffarmapaket:// bağlantısıyla ilk kez açılıyorsa argv'de gelir.
    const initialDeepLink = process.argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`))
    if (initialDeepLink) {
      win?.webContents.once('did-finish-load', () => handleDeepLink(initialDeepLink))
    }
  })
}
