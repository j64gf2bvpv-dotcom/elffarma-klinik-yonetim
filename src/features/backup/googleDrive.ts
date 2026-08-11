/**
 * Google Drive'a yedek yükleme — bir servis hesabı (Google Cloud Console'da
 * oluşturulan, insan girişi gerektirmeyen bir kimlik) kullanır. Kullanıcı
 * bu servis hesabının e-postasını kendi Drive'ındaki bir klasörle
 * "Düzenleyici" olarak paylaşır; bu dosya sadece o klasöre yazma izni
 * kadar erişebilir (drive.file scope — Drive'ın tamamına değil).
 *
 * Electron renderer'da Node'un `crypto` modülüne erişim yok (contextIsolation,
 * bkz. CLAUDE.md güvenlik sınırı) — bu yüzden JWT imzalama tamamen tarayıcının
 * yerleşik Web Crypto API'siyle (`crypto.subtle`) yapılıyor, ek bir npm
 * paketine gerek kalmadan.
 */

export interface GoogleServiceAccount {
  client_email: string
  private_key: string
  [key: string]: unknown
}

export interface GoogleDriveBackupConfig {
  serviceAccount: GoogleServiceAccount | null
  folderId: string
  enabled: boolean
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function signJwt(serviceAccount: GoogleServiceAccount, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: serviceAccount.client_email,
    scope,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }
  const encoder = new TextEncoder()
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const encodedClaims = base64UrlEncode(encoder.encode(JSON.stringify(claims)))
  const signingInput = `${encodedHeader}.${encodedClaims}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  const jwt = await signJwt(serviceAccount, DRIVE_SCOPE)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error_description ?? data?.error ?? 'Google\'dan erişim anahtarı alınamadı')
  }
  return data.access_token as string
}

export async function uploadBackupToGoogleDrive(
  config: GoogleDriveBackupConfig,
  filename: string,
  jsonContent: string,
): Promise<{ id: string }> {
  if (!config.serviceAccount) throw new Error('Google servis hesabı yapılandırılmamış')
  if (!config.folderId) throw new Error('Google Drive klasör ID\'si girilmemiş')

  const accessToken = await getAccessToken(config.serviceAccount)
  const boundary = `elffarma-backup-${Date.now()}`
  const metadata = { name: filename, parents: [config.folderId] }
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n${jsonContent}\r\n` +
    `--${boundary}--`

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'Google Drive\'a yüklenemedi')
  return { id: data.id as string }
}

/** Ayarlar > Yedekleme'deki "Bağlantıyı Test Et" için — servis hesabı token
 * alabiliyor mu ve verilen klasöre erişebiliyor mu (paylaşılmış mı) kontrol eder. */
export async function testGoogleDriveConnection(
  config: GoogleDriveBackupConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!config.serviceAccount) return { ok: false, message: 'Servis hesabı JSON\'ı eklenmedi' }
    if (!config.folderId) return { ok: false, message: 'Klasör ID\'si eklenmedi' }
    const accessToken = await getAccessToken(config.serviceAccount)
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${config.folderId}?fields=id,name&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await res.json()
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 404
            ? 'Klasör bulunamadı ya da servis hesabıyla paylaşılmamış'
            : (data?.error?.message ?? 'Bağlantı başarısız'),
      }
    }
    return { ok: true, message: `Bağlantı başarılı — klasör: "${data.name}"` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Bilinmeyen hata' }
  }
}
