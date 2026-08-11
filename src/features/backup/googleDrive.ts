/**
 * Google Drive'a yedek yükleme — bir servis hesabı (Google Cloud Console'da
 * oluşturulan, insan girişi gerektirmeyen bir kimlik) kullanır. Google'ın
 * JWT-Bearer token akışı ve Drive API'si tarayıcıdan (CORS) çağrılmak üzere
 * TASARLANMAMIŞ — bu yüzden asıl işlem (JWT imzalama, token alma, dosya
 * yükleme) burada değil, Electron'un ana sürecinde yapılıyor (bkz.
 * electron/googleDrive.ts, electron/preload.ts'teki `googleDriveUpload`/
 * `googleDriveTestConnection` köprüsü) — burası sadece o köprüyü çağıran
 * ince bir sarmalayıcı.
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

export async function uploadBackupToGoogleDrive(
  config: GoogleDriveBackupConfig,
  filename: string,
  jsonContent: string,
): Promise<{ id: string }> {
  if (!config.serviceAccount) throw new Error('Google servis hesabı yapılandırılmamış')
  if (!config.folderId) throw new Error('Google Drive klasör ID\'si girilmemiş')
  if (!window.electronAPI) throw new Error('Bu özellik sadece masaüstü uygulamasında çalışır')
  return window.electronAPI.googleDriveUpload(config.serviceAccount, config.folderId, filename, jsonContent)
}

/** Ayarlar > Yedekleme'deki "Bağlantıyı Test Et" için — servis hesabı token
 * alabiliyor mu ve verilen klasöre erişebiliyor mu (paylaşılmış mı) kontrol eder. */
export async function testGoogleDriveConnection(
  config: GoogleDriveBackupConfig,
): Promise<{ ok: boolean; message: string }> {
  if (!config.serviceAccount) return { ok: false, message: 'Servis hesabı JSON\'ı eklenmedi' }
  if (!config.folderId) return { ok: false, message: 'Klasör ID\'si eklenmedi' }
  if (!window.electronAPI) return { ok: false, message: 'Bu özellik sadece masaüstü uygulamasında çalışır' }
  try {
    return await window.electronAPI.googleDriveTestConnection(config.serviceAccount, config.folderId)
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Bilinmeyen hata' }
  }
}
