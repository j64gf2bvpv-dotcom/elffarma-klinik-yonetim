import { createSign } from 'node:crypto'

/**
 * Google'ın servis hesabı JWT-Bearer akışı (`oauth2.googleapis.com/token`)
 * ve Drive API'si tarayıcıdan (CORS) çağrılmak üzere tasarlanmamış — renderer
 * süreçten (contextIsolation altında normal bir Chromium sekmesi gibi CORS'a
 * tabi) doğrudan fetch edilince "Failed to fetch" ile başarısız oluyordu.
 * Bu yüzden tüm akış buraya, Electron'un ana (main) sürecine taşındı —
 * Node'un fetch/crypto'su bir tarayıcı olmadığı için CORS kısıtlaması yok.
 * Renderer, servis hesabı JSON'ını IPC üzerinden buraya gönderir (bkz.
 * preload.ts googleDriveUpload/googleDriveTestConnection), sonuç geri döner.
 */

export interface GoogleServiceAccount {
  client_email: string
  private_key: string
}

function base64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Kullanıcılar genelde tam Drive klasör linkini yapıştırıyor
 * (.../drive/folders/<ID>?usp=...) — ham ID de kabul edilir. */
function extractFolderId(input: string): string {
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : input.trim()
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: serviceAccount.client_email,
    // `drive.file` scope'u sadece uygulamanın KENDİ oluşturduğu/açtığı
    // dosyalara erişime izin verir — kullanıcının normal Paylaş menüsüyle
    // servis hesabına paylaştığı MEVCUT bir klasöre erişmek için daha geniş
    // `drive` kapsamı gerekiyor (aksi halde paylaşım doğru yapılsa bile
    // "klasör bulunamadı" 404'ü alınıyor).
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const encodedHeader = base64Url(Buffer.from(JSON.stringify(header)))
  const encodedClaims = base64Url(Buffer.from(JSON.stringify(claims)))
  const signingInput = `${encodedHeader}.${encodedClaims}`

  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = base64Url(signer.sign(serviceAccount.private_key))
  const jwt = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Google\'dan erişim anahtarı alınamadı')
  }
  return data.access_token as string
}

/**
 * Klasördeki, aynı ada sahip (yoksay: silinmiş/trash'teki) dosyayı arar —
 * kullanıcı isteği: yedekler her seferinde yeni bir dosya olarak birikmesin,
 * aynı ada sahip önceki yedeğin ÜZERİNE yazılsın. Adı sabit tutmak (çağıran
 * taraf her zaman aynı `filename`'i geçer) bu aramanın güvenilir çalışmasını
 * sağlıyor.
 */
async function findExistingFileId(accessToken: string, folderId: string, filename: string): Promise<string | null> {
  const query = `name='${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const data = (await res.json()) as { files?: { id: string }[]; error?: { message?: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Google Drive\'da mevcut yedek aranamadı')
  return data.files?.[0]?.id ?? null
}

export async function uploadBackupToGoogleDrive(
  serviceAccount: GoogleServiceAccount,
  folderIdOrUrl: string,
  filename: string,
  jsonContent: string,
): Promise<{ id: string }> {
  const folderId = extractFolderId(folderIdOrUrl)
  const accessToken = await getAccessToken(serviceAccount)
  const boundary = `elffarma-backup-${Date.now()}`
  const metadata = { name: filename, parents: [folderId] }
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n${jsonContent}\r\n` +
    `--${boundary}--`

  const existingId = await findExistingFileId(accessToken, folderId, filename)
  // Var olan dosyanın ÜZERİNE yaz (PATCH), yoksa ilk kez oluştur (POST) —
  // PATCH'te `parents` gönderilemez (ayrı bir "taşıma" isteği gerektirir),
  // dosya zaten doğru klasörde olduğu için metadata'dan çıkarılıyor.
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  const uploadBody = existingId
    ? body.replace(JSON.stringify(metadata), JSON.stringify({ name: filename }))
    : body

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: uploadBody,
  })
  const data = (await res.json()) as { id?: string; error?: { message?: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Google Drive\'a yüklenemedi')
  return { id: data.id as string }
}

export async function testGoogleDriveConnection(
  serviceAccount: GoogleServiceAccount,
  folderIdOrUrl: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const folderId = extractFolderId(folderIdOrUrl)
    const accessToken = await getAccessToken(serviceAccount)
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = (await res.json()) as { name?: string; error?: { message?: string } }
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 404
            ? 'Klasör bulunamadı ya da servis hesabıyla paylaşılmamış'
            : (data.error?.message ?? 'Bağlantı başarısız'),
      }
    }
    return { ok: true, message: `Bağlantı başarılı — klasör: "${data.name}"` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Bilinmeyen hata' }
  }
}
