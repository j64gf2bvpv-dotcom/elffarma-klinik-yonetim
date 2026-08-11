import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { CloudUpload, Download, Loader2, Trash2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useBackups, useBackupSettings, useCreateBackup, useDeleteBackup, openBackupFile } from './hooks'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Ayarlar sayfasındaki "Yedekleme" bölümü — sadece admin görür (backups
 * bucket'ına yazma/silme zaten sadece admin'e açık, bkz. schema.sql). Elle
 * "Şimdi Yedekle" düğmesi + geçmiş yedeklerin listesi (indir/sil). Otomatik
 * (24 saatte bir, açılışta) yedekleme için bkz. useAutoBackupOnLaunch —
 * burası sadece elle tetikleme ve geçmişi görüntüleme arayüzü.
 */
export function BackupSettingsCard() {
  const { staff } = useAuth()
  const { data: backups = [], isLoading } = useBackups()
  const { data: settings } = useBackupSettings()
  const createBackup = useCreateBackup()
  const deleteBackup = useDeleteBackup()
  const [openingPath, setOpeningPath] = React.useState<string | null>(null)

  if (staff?.role !== 'admin') return null

  async function handleOpen(path: string) {
    setOpeningPath(path)
    try {
      await openBackupFile(path)
    } finally {
      setOpeningPath(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
          <CloudUpload className="size-5" />
        </span>
        <div>
          <CardTitle>Yedekleme</CardTitle>
          <CardDescription>
            Müşteri, ürün, stok, tahsilat, satış gibi tüm iş verisi tek bir JSON dosyası olarak buluta
            (Supabase Storage) yedeklenir. Admin girişinde son yedekten 24 saatten fazla geçtiyse otomatik olarak
            da alınır — isterseniz aşağıdan elle de tetikleyebilirsiniz.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => createBackup.mutate()} disabled={createBackup.isPending}>
            {createBackup.isPending ? <Loader2 className="animate-spin" /> : <CloudUpload className="size-4" />}
            Şimdi Yedekle
          </Button>
          {settings.lastBackupAt && (
            <p className="text-muted-foreground text-sm">
              Son yedek: {format(new Date(settings.lastBackupAt), 'd MMMM yyyy HH:mm', { locale: trLocale })}
            </p>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Yedekler yükleniyor...</p>
        ) : backups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz yedek alınmadı.</p>
        ) : (
          <div className="grid gap-1.5">
            {backups.map((b) => (
              <div key={b.path} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {b.createdAt ? format(new Date(b.createdAt), 'd MMMM yyyy HH:mm', { locale: trLocale }) : b.path}
                  </p>
                  <p className="text-muted-foreground text-xs">{formatSize(b.sizeBytes)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpen(b.path)}
                    disabled={openingPath === b.path}
                    title="İndir"
                  >
                    {openingPath === b.path ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteBackup.mutate(b.path)}
                    disabled={deleteBackup.isPending}
                    title="Sil"
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
