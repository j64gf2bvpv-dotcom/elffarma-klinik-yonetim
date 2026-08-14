import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { toast } from 'sonner'
import { CloudUpload, Download, Loader2, Trash2, HardDrive, CheckCircle2 } from 'lucide-react'

import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/lib/auth'
import {
  useBackups,
  useBackupSettings,
  useCreateBackup,
  useDeleteBackup,
  openBackupFile,
  useGoogleDriveConfig,
  useSaveGoogleDriveConfig,
  useTestGoogleDriveConnection,
} from './hooks'
import type { GoogleServiceAccount } from './googleDrive'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Google Drive'a EK yedekleme — bir servis hesabı (Google Cloud Console'da
 * oluşturulan, insan girişi gerektirmeyen bir kimlik) kullanır. Kullanıcı bu
 * servis hesabının e-postasını kendi Drive'ındaki bir klasörle "Düzenleyici"
 * olarak paylaşmalı. Servis hesabı JSON'ı `admin_secrets` tablosunda (sadece
 * admin okuyabilir/yazabilir, bkz. schema.sql böl. 52) saklanır — güvenlik
 * gereği kaydedildikten sonra tekrar ekrana basılmaz, sadece "yapılandırılmış"
 * durumu gösterilir; değiştirmek için yeni bir JSON yapıştırılması gerekir.
 */
function GoogleDriveSection() {
  const { data: config } = useGoogleDriveConfig()
  const saveConfig = useSaveGoogleDriveConfig()
  const testConnection = useTestGoogleDriveConnection()
  const [jsonDraft, setJsonDraft] = React.useState('')
  const [folderId, setFolderId] = React.useState('')
  const [enabled, setEnabled] = React.useState(false)
  const [syncedFromServer, setSyncedFromServer] = React.useState(false)

  React.useEffect(() => {
    if (syncedFromServer) return
    setFolderId(config.folderId)
    setEnabled(config.enabled)
    setSyncedFromServer(true)
  }, [config, syncedFromServer])

  function resolveServiceAccount(): GoogleServiceAccount | null {
    if (!jsonDraft.trim()) return config.serviceAccount
    try {
      const parsed = JSON.parse(jsonDraft)
      if (!parsed.client_email || !parsed.private_key) {
        toast.error('Geçersiz servis hesabı JSON\'ı', {
          description: '"client_email" ve "private_key" alanları bulunamadı.',
        })
        return null
      }
      return parsed as GoogleServiceAccount
    } catch {
      toast.error('JSON ayrıştırılamadı', { description: 'Google Cloud Console\'dan indirdiğiniz dosyanın tamamını yapıştırın.' })
      return null
    }
  }

  function handleSave() {
    const serviceAccount = jsonDraft.trim() ? resolveServiceAccount() : config.serviceAccount
    if (jsonDraft.trim() && !serviceAccount) return // resolveServiceAccount zaten hata gösterdi
    saveConfig.mutate({ serviceAccount, folderId: folderId.trim(), enabled })
    setJsonDraft('')
  }

  function handleTest() {
    const serviceAccount = resolveServiceAccount()
    if (jsonDraft.trim() && !serviceAccount) return
    testConnection.mutate({ serviceAccount, folderId: folderId.trim(), enabled })
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <HardDrive className="text-muted-foreground size-4" />
        <p className="text-sm font-medium">Google Drive (ek yedek)</p>
        {config.serviceAccount && (
          <span className="text-success flex items-center gap-1 text-xs">
            <CheckCircle2 className="size-3.5" /> {config.serviceAccount.client_email}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Google Cloud Console'da oluşturduğunuz bir servis hesabının JSON anahtarını yapıştırın ve o servis
        hesabının e-postasını Drive'daki hedef klasörle "Düzenleyici" olarak paylaşın. Her yedek alındığında,
        etkinse, aynı dosya bu klasöre de yüklenir.
      </p>
      <div className="grid gap-1.5">
        <Label className="text-xs">Servis Hesabı JSON'ı {config.serviceAccount && '(değiştirmek için yeni yapıştırın)'}</Label>
        <Textarea
          rows={4}
          placeholder='{ "client_email": "...", "private_key": "-----BEGIN PRIVATE KEY-----..." }'
          value={jsonDraft}
          onChange={(e) => setJsonDraft(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Drive Klasör ID'si</Label>
        <Input
          placeholder="Klasör linkindeki /folders/ sonrasındaki kısım"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} id="drive-enabled" />
        <Label htmlFor="drive-enabled" className="!mt-0 text-sm font-normal">
          Yedeklerde Google Drive'a da yükle
        </Label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
          {testConnection.isPending && <Loader2 className="animate-spin" />}
          Bağlantıyı Test Et
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          {saveConfig.isPending && <Loader2 className="animate-spin" />}
          Kaydet
        </Button>
      </div>
    </div>
  )
}

/**
 * Ayarlar sayfasındaki "Yedekleme" bölümü — sadece admin görür (backups
 * bucket'ına yazma/silme zaten sadece admin'e açık, bkz. schema.sql). Elle
 * "Şimdi Yedekle" düğmesi + geçmiş yedeklerin listesi (indir/sil). Otomatik
 * (2 günde bir, açılışta) yedekleme için bkz. useAutoBackupOnLaunch —
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
    <CollapsibleCard
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
          <CloudUpload className="size-5" />
        </span>
      }
      title="Yedekleme"
      description="Müşteri, ürün, stok, tahsilat, satış gibi tüm iş verisi tek bir JSON dosyası olarak buluta (Supabase Storage) yedeklenir. Admin girişinde son yedekten 2 günden fazla geçtiyse otomatik olarak da alınır — isterseniz aşağıdan elle de tetikleyebilirsiniz. Google Drive'a yüklenen kopya, birikmesin diye her seferinde aynı dosyanın üzerine yazılır."
    >
      <div className="grid gap-4">
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

        <GoogleDriveSection />
      </div>
    </CollapsibleCard>
  )
}
