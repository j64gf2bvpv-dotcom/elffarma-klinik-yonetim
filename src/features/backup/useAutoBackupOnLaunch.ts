import * as React from 'react'
import { toast } from 'sonner'
import { fetchAppSetting, saveAppSetting } from '@/features/appSettings/api'
import { createBackup } from './api'
import { fetchAdminSecret } from './adminSecrets'
import { uploadBackupToGoogleDrive, type GoogleDriveBackupConfig } from './googleDrive'
import type { BackupSettings } from './hooks'

const BACKUP_SETTINGS_KEY = 'backup_settings'
const GOOGLE_DRIVE_CONFIG_KEY = 'google_drive_backup'
const THROTTLE_MS = 24 * 60 * 60 * 1000

let hasCheckedThisSession = false

/**
 * Uygulama açılışında (oturum başına bir kez, admin'e girişte) son yedekten
 * bu yana 24 saatten fazla geçtiyse sessizce yeni bir buluta yedek alır.
 * `app_settings` yazması sadece admin'e açık olduğu için (bkz. schema.sql
 * app_settings RLS) bu hook SADECE admin oturumunda tetiklenir — personel
 * girişinde hiçbir şey yapmaz, Ayarlar > Yedekleme'den elle yedek almayı
 * bekler. Başarısız olursa sessizce geçilir (açılışta kullanıcıyı bir ağ/
 * yapılandırma hatasıyla karşılamamak için) — sonuç sadece konsola loglanır.
 */
export function useAutoBackupOnLaunch(isAdmin: boolean) {
  React.useEffect(() => {
    if (!isAdmin || hasCheckedThisSession) return
    hasCheckedThisSession = true

    const timer = setTimeout(async () => {
      try {
        const settings = await fetchAppSetting<BackupSettings>(BACKUP_SETTINGS_KEY)
        const lastBackupAt = settings?.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0
        if (Date.now() - lastBackupAt < THROTTLE_MS) return

        const result = await createBackup()
        await saveAppSetting<BackupSettings>(BACKUP_SETTINGS_KEY, { lastBackupAt: new Date().toISOString() })

        const driveConfig = await fetchAdminSecret<GoogleDriveBackupConfig>(GOOGLE_DRIVE_CONFIG_KEY)
        if (driveConfig?.enabled) {
          try {
            await uploadBackupToGoogleDrive(driveConfig, result.path, result.json)
          } catch (err) {
            console.error('Otomatik Google Drive yedeklemesi başarısız', err)
          }
        }

        toast.success('Otomatik buluta yedekleme tamamlandı', {
          description: 'Ayarlar > Yedekleme\'den geçmiş yedekleri görebilirsiniz.',
        })
      } catch (err) {
        console.error('Otomatik yedekleme başarısız', err)
      }
    }, 4000)

    return () => clearTimeout(timer)
  }, [isAdmin])
}
