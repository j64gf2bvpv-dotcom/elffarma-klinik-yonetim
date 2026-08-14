import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBackup, deleteBackup, getBackupDownloadUrl, listBackups } from './api'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'
import { fetchAdminSecret, saveAdminSecret } from './adminSecrets'
import {
  testGoogleDriveConnection,
  uploadBackupToGoogleDrive,
  DRIVE_BACKUP_FILENAME,
  type GoogleDriveBackupConfig,
} from './googleDrive'

const BACKUP_SETTINGS_KEY = 'backup_settings'
const GOOGLE_DRIVE_CONFIG_KEY = 'google_drive_backup'

export interface BackupSettings {
  lastBackupAt: string | null
}

const defaultBackupSettings: BackupSettings = { lastBackupAt: null }
const defaultGoogleDriveConfig: GoogleDriveBackupConfig = { serviceAccount: null, folderId: '', enabled: false }

/** `app_settings` yazması admin'e kapalı olduğu için bu ayarı sadece admin
 * güncelleyebilir (bkz. useAutoBackupOnLaunch — bilerek sadece admin
 * oturumunda tetikleniyor). */
export function useBackupSettings() {
  const query = useAppSetting<BackupSettings>(BACKUP_SETTINGS_KEY)
  return { ...query, data: query.data ?? defaultBackupSettings }
}

export function useSaveBackupSettings() {
  return useSaveAppSetting<BackupSettings>(BACKUP_SETTINGS_KEY)
}

export function useBackups() {
  return useQuery({ queryKey: ['backups'], queryFn: listBackups })
}

export function useGoogleDriveConfig() {
  const query = useQuery({
    queryKey: ['admin_secrets', GOOGLE_DRIVE_CONFIG_KEY],
    queryFn: () => fetchAdminSecret<GoogleDriveBackupConfig>(GOOGLE_DRIVE_CONFIG_KEY),
  })
  return { ...query, data: query.data ?? defaultGoogleDriveConfig }
}

export function useSaveGoogleDriveConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: GoogleDriveBackupConfig) => saveAdminSecret(GOOGLE_DRIVE_CONFIG_KEY, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_secrets', GOOGLE_DRIVE_CONFIG_KEY] })
      toast.success('Google Drive ayarları kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useTestGoogleDriveConnection() {
  return useMutation({
    mutationFn: (config: GoogleDriveBackupConfig) => testGoogleDriveConnection(config),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message)
      else toast.error('Bağlantı başarısız', { description: result.message })
    },
    onError: (error: Error) => toast.error('Test edilemedi', { description: error.message }),
  })
}

/** Supabase Storage'a yedek alır; Google Drive entegrasyonu yapılandırılıp
 * etkinleştirilmişse (bkz. useGoogleDriveConfig) AYNI JSON içeriği (tabloları
 * ikinci kez çekmeden, tek bir tutarlı anlık görüntüyle) Drive'a da yüklenir
 * — Drive yüklemesi başarısız olursa Supabase'e alınan yedek yine de geçerli
 * sayılır, sadece ayrıca raporlanır. */
export function useCreateBackup() {
  const queryClient = useQueryClient()
  const saveSettings = useSaveBackupSettings()
  return useMutation({
    mutationFn: async () => {
      const result = await createBackup()
      const driveConfig = await fetchAdminSecret<GoogleDriveBackupConfig>(GOOGLE_DRIVE_CONFIG_KEY)
      let driveError: string | null = null
      let driveUploaded = false
      if (driveConfig?.enabled) {
        try {
          await uploadBackupToGoogleDrive(driveConfig, DRIVE_BACKUP_FILENAME, result.json)
          driveUploaded = true
        } catch (err) {
          driveError = err instanceof Error ? err.message : 'Bilinmeyen hata'
        }
      }
      return { ...result, driveUploaded, driveError }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      saveSettings.mutate({ lastBackupAt: new Date().toISOString() })
      const totalRows = Object.values(result.tableCounts).reduce((sum, n) => sum + n, 0)
      const descriptionParts = [
        result.failedTables.length > 0
          ? `${result.failedTables.length} tablo atlandı: ${result.failedTables.join(', ')}`
          : '',
        result.driveUploaded ? 'Google Drive\'a da yüklendi.' : '',
        result.driveError ? `Google Drive'a yüklenemedi: ${result.driveError}` : '',
      ].filter(Boolean)
      toast.success(`Yedek alındı — ${totalRows} kayıt`, {
        description: descriptionParts.length > 0 ? descriptionParts.join(' ') : undefined,
      })
    },
    onError: (error: Error) => toast.error('Yedek alınamadı', { description: error.message }),
  })
}

export function useDeleteBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      toast.success('Yedek silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export async function openBackupFile(path: string) {
  const url = await getBackupDownloadUrl(path)
  // Electron main process intercepts window.open() and routes it to
  // shell.openExternal (bkz. InvoiceDialog.tsx'teki aynı desen).
  window.open(url, '_blank', 'noopener,noreferrer')
}
