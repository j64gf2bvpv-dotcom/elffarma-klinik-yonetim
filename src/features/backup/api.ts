import { supabase } from '@/lib/supabaseClient'
import { BACKUP_TABLES } from './tables'

export interface BackupFile {
  path: string
  createdAt: string
  sizeBytes: number
}

export interface CreateBackupResult {
  path: string
  sizeBytes: number
  tableCounts: Record<string, number>
  /** Şema henüz o tabloyu içermiyorsa (migration çalıştırılmadan önce) ya da
   * beklenmedik bir hata alınırsa, o tablo atlanır — TÜM yedek işlemi bu
   * yüzden başarısız olmaz, sadece hangi tabloların eksik kaldığı raporlanır. */
  failedTables: string[]
}

async function dumpAllTables(): Promise<{ tables: Record<string, unknown[]>; failedTables: string[] }> {
  const tables: Record<string, unknown[]> = {}
  const failedTables: string[] = []
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      failedTables.push(table)
      continue
    }
    tables[table] = data ?? []
  }
  return { tables, failedTables }
}

/**
 * Tüm iş verisi tablolarını (bkz. BACKUP_TABLES) TEK bir JSON dosyasına
 * dökülüp `backups` Storage bucket'ına yüklenir — dosya adı zaman damgalı
 * olduğu için her yedek ayrı bir dosya olarak birikir (üzerine yazma yok).
 */
export async function createBackup(): Promise<CreateBackupResult> {
  const { tables, failedTables } = await dumpAllTables()
  const payload = { createdAt: new Date().toISOString(), tables }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const path = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`

  const { error: uploadError } = await supabase.storage
    .from('backups')
    .upload(path, blob, { upsert: true, contentType: 'application/json' })
  if (uploadError) throw uploadError

  const tableCounts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]))
  return { path, sizeBytes: blob.size, tableCounts, failedTables }
}

export async function listBackups(): Promise<BackupFile[]> {
  const { data, error } = await supabase.storage
    .from('backups')
    .list('', { sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error
  return (data ?? [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => ({
      path: f.name,
      createdAt: f.created_at ?? f.updated_at ?? '',
      sizeBytes: (f.metadata as { size?: number } | null)?.size ?? 0,
    }))
}

export async function getBackupDownloadUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('backups').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function deleteBackup(path: string): Promise<void> {
  const { error } = await supabase.storage.from('backups').remove([path])
  if (error) throw error
}
