import { app, BrowserWindow, Menu, shell, Notification, ipcMain, session } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { uploadBackupToGoogleDrive, testGoogleDriveConnection, type GoogleServiceAccount } from './googleDrive.js'

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

// Pencereli (GUI) bir uygulamada console.log/error hiçbir yere yazılmıyor —
// terminal olmadığı için kayboluyor. Güncelleme sorunlarını (özellikle
// macOS'ta imzasız paketleme nedeniyle Squirrel.Mac'in doğrulama hatası
// vermesi gibi sessiz başarısızlıkları) sonradan teşhis edebilmek için
// autoUpdater'ın TÜM olaylarını kalıcı bir dosyaya yazıyoruz.
const updaterLogPath = path.join(app.getPath('logs'), 'auto-updater.log')
function logUpdater(line: string) {
  try {
    fs.appendFileSync(updaterLogPath, `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    // Log dosyasına yazılamaması güncellemeyi engellememeli.
  }
}

// Ayarlar > Güncellemeler kartının canlı durum gösterebilmesi için autoUpdater
// olaylarını renderer'a da iletiyoruz (log dosyasına yazmanın yanında).
type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

function sendUpdaterEvent(event: UpdaterEvent) {
  win?.webContents.send('updater:event', event)
}

// Olay dinleyicileri her zaman kayıtlı (bedelsiz) — asıl ağ isteğini tetikleyen
// checkForUpdates çağrısı ise sadece paketlenmiş (kurulmuş) uygulamada anlamlı
// olduğu için hem başlangıç otomatik kontrolünde hem manuel IPC'de
// `app.isPackaged` ile korunuyor; `npm run dev`'de update feed'i olmadığından
// autoUpdater sessizce hata verir.
function setupAutoUpdater() {
  logUpdater(`Başlatıldı — mevcut sürüm: ${app.getVersion()}`)
  autoUpdater.on('checking-for-update', () => {
    logUpdater('Güncelleme kontrol ediliyor...')
    sendUpdaterEvent({ type: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    logUpdater(`Güncelleme bulundu: ${info.version}`)
    sendUpdaterEvent({ type: 'available', version: info.version })
    // İndirme (bağlantı hızına göre biraz sürebilir) bitmesini beklemeden,
    // yeni sürüm fark edilir edilmez de bildirim gösteriliyor.
    if (Notification.isSupported()) {
      new Notification({
        title: 'Yeni güncelleme bulundu',
        body: `v${info.version} indiriliyor, hazır olunca ayrıca haber verilecek.`,
      }).show()
    }
  })
  autoUpdater.on('update-not-available', (info) => {
    logUpdater(`Güncelleme yok, güncel: ${info.version}`)
    sendUpdaterEvent({ type: 'not-available', version: info.version })
  })
  autoUpdater.on('download-progress', (p) => {
    logUpdater(`İndiriliyor: %${p.percent.toFixed(1)}`)
    sendUpdaterEvent({ type: 'progress', percent: p.percent })
  })
  autoUpdater.on('update-downloaded', (info) => {
    logUpdater(`İndirildi, yeniden başlatma bekleniyor: ${info.version}`)
    sendUpdaterEvent({ type: 'downloaded', version: info.version })
    // Kullanıcı isteği: güncellemeler hiçbir tıklama gerektirmeden, sistem
    // bildirimi olarak haber versin. `autoInstallOnAppQuit` electron-updater'da
    // varsayılan olarak açık — uygulama normal şekilde kapatılıp açıldığında
    // (kimseyi ortasından kesmeden) güncelleme zaten otomatik kuruluyor; burada
    // sadece bunun gerçekleştiğini bildiren bir OS bildirimi ekliyoruz.
    if (Notification.isSupported()) {
      new Notification({
        title: 'Güncelleme hazır',
        body: `v${info.version} indirildi. Uygulamayı bir sonraki kapatıp açışınızda otomatik kurulacak.`,
      }).show()
    }
  })
  autoUpdater.on('error', (error) => {
    logUpdater(`HATA: ${error.message}\n${error.stack ?? ''}`)
    console.error('[AutoUpdater] Güncelleme kontrolü başarısız:', error)
    sendUpdaterEvent({ type: 'error', message: error.message })
  })
}

// Fiyat listesi PDF'i için ürün görsellerini indirme (2026-10-02) — ürün
// görselleri CORS başlığı göndermeyen sitelerde (Dermakor mağazası,
// elffarma.com) duruyor, renderer piksellere erişemiyor. Sadece https,
// gerçekten image/* dönen ve 8 MB'tan küçük yanıtlar data: URL olarak döner.
ipcMain.handle('image:fetch-data-url', async (_event, url: string) => {
  if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url)) return null
  try {
    const res = await fetch(url, { redirect: 'follow' })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})

// Kongre web sitesinden bilgi çekme (kullanıcı isteği, 2026-10-21: "web sitesi
// üzerinden bağlanabilsin, gerçek bilgiler çekilebilsin") — çoğu site CORS
// başlığı göndermediği için renderer doğrudan okuyamıyor. SADECE http(s), GET,
// 15 sn zaman aşımı, HTML dönen ve 3 MB'tan küçük yanıtlar; sadece metin döner.
ipcMain.handle('page:fetch-html', async (_event, url: string) => {
  if (typeof url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(url)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Elffarma Paket Programi)', Accept: 'text/html,application/xhtml+xml' },
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/text\/html|application\/xhtml/i.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 3 * 1024 * 1024) return null
    return { url: res.url, html: buf.toString('utf8') }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
})

// Instagram yeni paylaşım bildirimi (kullanıcı isteği, 2026-10-21: "@elffarma
// instagram adresinden paylaşım yapıldığında bildirim gelsin, popup şeklinde").
// Instagram oturumsuz isteklere veri vermiyor; kullanıcı programın içinde AYRI
// bir oturumda (persist:instagram — uygulamanın kendi oturumundan bağımsız) bir
// kez giriş yapar, sonra son paylaşımlar bu oturumla okunur. Sadece kullanıcı
// adı (harf/rakam/._) kabul edilir, sadece okunur; şifre programda saklanmaz.
const IG_PARTITION = 'persist:instagram'
const IG_USERNAME = /^[A-Za-z0-9._]{1,30}$/

ipcMain.handle('instagram:login', async () => {
  const win = new BrowserWindow({
    width: 480,
    height: 760,
    title: 'Instagram — giriş',
    webPreferences: { partition: IG_PARTITION, nodeIntegration: false, contextIsolation: true },
  })
  await win.loadURL('https://www.instagram.com/accounts/login/')
  return new Promise<boolean>((resolve) => {
    win.on('closed', async () => {
      const cookies = await session.fromPartition(IG_PARTITION).cookies.get({ domain: 'instagram.com', name: 'sessionid' })
      resolve(cookies.length > 0)
    })
  })
})

ipcMain.handle('instagram:status', async () => {
  const cookies = await session.fromPartition(IG_PARTITION).cookies.get({ domain: 'instagram.com', name: 'sessionid' })
  return { loggedIn: cookies.length > 0 }
})

ipcMain.handle('instagram:recent-posts', async (_event, username: string) => {
  if (typeof username !== 'string' || !IG_USERNAME.test(username)) return { error: 'invalid' }
  const ses = session.fromPartition(IG_PARTITION)
  const loggedIn = (await ses.cookies.get({ domain: 'instagram.com', name: 'sessionid' })).length > 0
  if (!loggedIn) return { error: 'login' }
  try {
    const res = await ses.fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: { 'x-ig-app-id': '936619743392459', Accept: 'application/json' },
    })
    if (res.status === 401 || res.status === 403) return { error: 'login' }
    if (!res.ok) return { error: `http-${res.status}` }
    const data = (await res.json()) as {
      data?: { user?: { edge_owner_to_timeline_media?: { edges?: { node: Record<string, unknown> }[] } } }
    }
    const edges = data.data?.user?.edge_owner_to_timeline_media?.edges ?? []
    const posts = edges.slice(0, 6).map(({ node }) => {
      const captionEdges = (node.edge_media_to_caption as { edges?: { node: { text: string } }[] } | undefined)?.edges ?? []
      return {
        id: String(node.id),
        shortcode: String(node.shortcode),
        takenAt: Number(node.taken_at_timestamp) * 1000,
        isVideo: Boolean(node.is_video),
        caption: captionEdges[0]?.node.text ?? '',
        thumbnail: String(node.thumbnail_src ?? node.display_url ?? ''),
      }
    })
    return { posts }
  } catch {
    return { error: 'network' }
  }
})

// Instagram sayfasının daha eski paylaşımları (kullanıcı isteği, 2026-10-23:
// "Adana Masterclass / Ali Şahan Kliniği detaylarını ve resimlerini @elffarma
// Instagram sayfasından çek") — kongre/etkinlik kartına açıklama ve görsel
// almak için. Programın kendi Instagram oturumu (persist:instagram) kullanılır;
// en fazla 5 sayfa (~165 paylaşım) geriye gider. Galeri paylaşımlarının tüm
// görselleri döner.
ipcMain.handle('instagram:user-feed', async (_event, username: string, maxPages = 3) => {
  if (typeof username !== 'string' || !IG_USERNAME.test(username)) return { error: 'invalid' }
  const pages = Math.min(5, Math.max(1, Number(maxPages) || 1))
  const ses = session.fromPartition(IG_PARTITION)
  const loggedIn = (await ses.cookies.get({ domain: 'instagram.com', name: 'sessionid' })).length > 0
  if (!loggedIn) return { error: 'login' }
  type Cand = { url: string; width: number }
  type Item = {
    code?: string
    taken_at?: number
    caption?: { text?: string } | null
    media_type?: number
    image_versions2?: { candidates?: Cand[] }
    carousel_media?: { image_versions2?: { candidates?: Cand[] } }[]
    user?: { pk?: string | number }
  }
  const best = (c?: Cand[]) => (c ?? []).slice().sort((a, b) => b.width - a.width)[0]?.url
  const posts: { shortcode: string; takenAt: number; caption: string; images: string[]; isVideo: boolean }[] = []
  let url = `https://www.instagram.com/api/v1/feed/user/${username}/username/?count=33`
  let userId: string | null = null
  try {
    const csrf = (await ses.cookies.get({ domain: 'instagram.com', name: 'csrftoken' }))[0]?.value ?? ''
    const headers = {
      'x-ig-app-id': '936619743392459',
      'x-requested-with': 'XMLHttpRequest',
      'x-csrftoken': csrf,
      Accept: '*/*',
      Referer: `https://www.instagram.com/${username}/`,
    }
    for (let i = 0; i < pages && url; i++) {
      const res = await ses.fetch(url, { headers })
      if (res.status === 401 || res.status === 403) return { error: 'login', posts }
      if (!res.ok) return { error: `http-${res.status}`, posts }
      const text = await res.text()
      // Instagram geçici engelde / oturum düşünce JSON yerine sayfa döndürüyor
      if (!text.trimStart().startsWith('{')) return { error: 'blocked', posts }
      const data = JSON.parse(text) as { items?: Item[]; more_available?: boolean; next_max_id?: string; user?: { pk?: string | number } }
      for (const it of data.items ?? []) {
        userId ??= it.user?.pk != null ? String(it.user.pk) : null
        const images = it.carousel_media?.length
          ? it.carousel_media.map((m) => best(m.image_versions2?.candidates)).filter((u): u is string => !!u)
          : [best(it.image_versions2?.candidates)].filter((u): u is string => !!u)
        posts.push({ shortcode: String(it.code ?? ''), takenAt: Number(it.taken_at ?? 0) * 1000, caption: it.caption?.text ?? '', images, isVideo: it.media_type === 2 })
      }
      userId ??= data.user?.pk != null ? String(data.user.pk) : null
      url = data.more_available && data.next_max_id && userId ? `https://www.instagram.com/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(data.next_max_id)}` : ''
    }
    return { posts }
  } catch (err) {
    return { error: `network: ${String(err).slice(0, 200)}`, posts }
  }
})

// Instagram görselini data URL olarak getir (CDN tarayıcıdan CORS ile okunamıyor) —
// sadece Instagram/Facebook CDN adresleri, en fazla 8 MB.
ipcMain.handle('instagram:image', async (_event, imageUrl: string) => {
  try {
    const u = new URL(imageUrl)
    if (u.protocol !== 'https:' || !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname)) return null
    const res = await session.fromPartition(IG_PARTITION).fetch(u.toString())
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})

// Ruhsat okuma için İŞLETİM SİSTEMİNİN yazı tanıması (kullanıcı isteği, 2026-10-21:
// "şase, motor no vb. okumuyor, hepsini okusun") — macOS'ta Apple Vision
// (Canlı Metin ile aynı motor, JXA üzerinden), Windows'ta Windows.Media.Ocr
// (PowerShell + WinRT). Tamamen bilgisayarda çalışır, internete/yapay zekâya
// gönderilmez. Sadece PNG/JPEG data URL kabul edilir; görsel geçici dosyaya
// yazılıp okunduktan sonra silinir. Desteklenmezse null döner (renderer
// Tesseract'a düşer). Dönen kutular piksel cinsinden, sol-üst köşe orijinli.
const MAC_VISION_SCRIPT = `
ObjC.import('Foundation'); ObjC.import('Vision');
function run(argv) {
  const all = [];
  for (const p of argv) {
    const url = $.NSURL.fileURLWithPath(p);
    const handler = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $.NSDictionary.dictionary);
    const req = $.VNRecognizeTextRequest.alloc.init;
    req.recognitionLevel = 0;
    req.usesLanguageCorrection = false;
    req.recognitionLanguages = $(['tr-TR', 'en-US']);
    handler.performRequestsError($([req]), Ref());
    const r = req.results; const out = [];
    for (let i = 0; i < r.count; i++) {
      const o = r.objectAtIndex(i); const c = o.topCandidates(1).objectAtIndex(0); const b = o.boundingBox;
      out.push({ t: c.string.js, c: c.confidence, x: b.origin.x, y: b.origin.y, w: b.size.width, h: b.size.height });
    }
    all.push(out);
  }
  return JSON.stringify(all);
}`

const WIN_OCR_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$lang = New-Object Windows.Globalization.Language('tr')
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) } else { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
$all = @()
foreach ($path in $args) {
  if ($null -eq $engine) { $all += '[]'; continue }
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $W = [double]$bitmap.PixelWidth; $H = [double]$bitmap.PixelHeight
  $out = @()
  foreach ($line in $result.Lines) {
    $rs = $line.Words | ForEach-Object { $_.BoundingRect }
    $x0 = ($rs | Measure-Object -Property X -Minimum).Minimum
    $y0 = ($rs | Measure-Object -Property Y -Minimum).Minimum
    $x1 = ($rs | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum
    $y1 = ($rs | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
    $out += [pscustomobject]@{ t = $line.Text; x = $x0 / $W; y = 1 - ($y1 / $H); w = ($x1 - $x0) / $W; h = ($y1 - $y0) / $H }
  }
  $stream.Dispose()
  if ($out.Count -eq 0) { $all += '[]' } else { $all += (ConvertTo-Json -InputObject @($out) -Compress) }
}
Write-Output ('[' + ($all -join ',') + ']')
`

type NativeOcrLine = { t: string; c?: number; x: number; y: number; w: number; h: number }

// Tek görsel (string) ya da toplu (string[] — ruhsat kutuları tek seferde, en fazla 200) kabul edilir.
ipcMain.handle('ocr:native', async (_event, input: string | string[]) => {
  const list = typeof input === 'string' ? [input] : Array.isArray(input) ? input.slice(0, 200) : []
  if (list.length === 0 || list.some((d) => typeof d !== 'string')) return null
  if (process.platform !== 'darwin' && process.platform !== 'win32') return null
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elffarma-ocr-'))
  try {
    const imgPaths: string[] = []
    for (const [i, dataUrl] of list.entries()) {
      const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
      if (!m) return null
      const imgPath = path.join(dir, `img${i}.${m[1] === 'png' ? 'png' : 'jpg'}`)
      fs.writeFileSync(imgPath, Buffer.from(m[2], 'base64'))
      imgPaths.push(imgPath)
    }
    let stdout: string
    if (process.platform === 'darwin') {
      const scriptPath = path.join(dir, 'vision.js')
      fs.writeFileSync(scriptPath, MAC_VISION_SCRIPT)
      stdout = await execFileText('osascript', ['-l', 'JavaScript', scriptPath, ...imgPaths])
    } else {
      const scriptPath = path.join(dir, 'ocr.ps1')
      fs.writeFileSync(scriptPath, WIN_OCR_SCRIPT)
      stdout = await execFileText('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...imgPaths])
    }
    const all = JSON.parse(stdout.trim() || '[]') as NativeOcrLine[][]
    if (!Array.isArray(all) || all.length !== list.length) return null
    return typeof input === 'string' ? all[0] : all
  } catch (err) {
    console.error('[ocr:native]', err)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function execFileText(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve(stdout)))
  })
}

// Narrow IPC surface used by the renderer's preload bridge.
// wa.me (tarayıcı üzerinden) ya da — toplu WhatsApp gönderiminde sohbeti doğrudan
// masaüstü uygulamasında açmak için (2026-10-02) — SADECE
// "whatsapp://send?phone=<rakam>&text=<kodlanmış metin>" biçimi kabul edilir.
const WHATSAPP_APP_URL = /^whatsapp:\/\/send\?phone=\d{10,15}&text=[^\s]*$/
ipcMain.handle('shell:open-external', (_event, url: string) => {
  if (typeof url === 'string' && (/^https:\/\/wa\.me\//.test(url) || WHATSAPP_APP_URL.test(url))) {
    shell.openExternal(url)
    return true
  }
  return false
})

// TopBar'daki bağlantı göstergesine tıklayınca işletim sisteminin kendi WiFi/ağ
// ayarları penceresini açar — Electron'un (ve web'in) bir web sayfasından ağ
// listeleyip bağlanma yetkisi yok, bu yüzden gerçek bir "içeride WiFi seç"
// aracı yerine sadece OS'un kendi ayar ekranına kısayol sunuluyor.
ipcMain.handle('shell:open-network-settings', () => {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.wifi-settings-extension')
  } else if (process.platform === 'win32') {
    shell.openExternal('ms-settings:network-wifi')
  }
})

ipcMain.handle('app:notify', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

// Ayarlar > Güncellemeler kartındaki "Güncellemeyi Kontrol Et" butonu buraya bağlanır.
// Geliştirme modunda (npm run dev, paketlenmemiş) kontrol edilecek bir update feed'i
// olmadığından gerçek bir kontrol denemek yerine bunu doğrudan renderer'a bildiriyoruz.
ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) {
    return { ok: false, reason: 'not-packaged' as const }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logUpdater(`Manuel kontrol HATA: ${message}`)
    return { ok: false as const, reason: 'error' as const, message }
  }
})

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
})

// Google'ın servis hesabı JWT-Bearer akışı tarayıcıdan (CORS) çağrılamadığı
// için buradan (Node, CORS'a tabi değil) yürütülüyor — bkz. googleDrive.ts.
ipcMain.handle(
  'backup:google-drive-upload',
  (_event, serviceAccount: GoogleServiceAccount, folderId: string, filename: string, jsonContent: string) =>
    uploadBackupToGoogleDrive(serviceAccount, folderId, filename, jsonContent),
)

ipcMain.handle(
  'backup:google-drive-test',
  (_event, serviceAccount: GoogleServiceAccount, folderId: string) =>
    testGoogleDriveConnection(serviceAccount, folderId),
)

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
    setupAutoUpdater()
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((error) => {
        logUpdater(`checkForUpdatesAndNotify HATA: ${error.message}`)
        console.error('[AutoUpdater] checkForUpdatesAndNotify başarısız:', error)
      })
      // Bu bir ERP yazılımı — uygulama günlerce hiç kapatılmadan açık kalabilir.
      // Sadece başlangıçtaki tek seferlik kontrol yeterli değil, yoksa uygulama
      // zaten açıkken yayınlanan bir güncelleme hiç fark edilmez (kullanıcı
      // raporu: "program açık, bildirim gelmedi"). Açık kaldığı sürece saatte
      // bir arka planda tekrar kontrol ediyoruz.
      setInterval(
        () => {
          autoUpdater.checkForUpdatesAndNotify().catch((error) => {
            logUpdater(`Periyodik güncelleme kontrolü HATA: ${error.message}`)
          })
        },
        60 * 60 * 1000,
      )
    }
    // Windows: uygulama elffarmapaket:// bağlantısıyla ilk kez açılıyorsa argv'de gelir.
    const initialDeepLink = process.argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`))
    if (initialDeepLink) {
      win?.webContents.once('did-finish-load', () => handleDeepLink(initialDeepLink))
    }
  })
}
