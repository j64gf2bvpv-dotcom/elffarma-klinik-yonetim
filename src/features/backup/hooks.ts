import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBackup, deleteBackup, getBackupDownloadUrl, listBackups } from './api'
import { useAppSetting, useSaveAppSetting } from '@/features/appSettings/hooks'

const BACKUP_SETTINGS_KEY = 'backup_settings'

export interface BackupSettings {
  lastBackupAt: string | null
}

const defaultBackupSettings: BackupSettings = { lastBackupAt: null }

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

export function useCreateBackup() {
  const queryClient = useQueryClient()
  const saveSettings = useSaveBackupSettings()
  return useMutation({
    mutationFn: createBackup,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      saveSettings.mutate({ lastBackupAt: new Date().toISOString() })
      const totalRows = Object.values(result.tableCounts).reduce((sum, n) => sum + n, 0)
      toast.success(`Yedek alındı — ${totalRows} kayıt`, {
        description:
          result.failedTables.length > 0
            ? `${result.failedTables.length} tablo atlandı (henüz şemada yok olabilir): ${result.failedTables.join(', ')}`
            : undefined,
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
