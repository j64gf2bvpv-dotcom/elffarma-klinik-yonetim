import * as React from 'react'
import { RefreshCw, Loader2, CheckCircle2, DownloadCloud, AlertTriangle, RotateCw } from 'lucide-react'

import { CollapsibleCard } from '@/components/ui/collapsible-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Status = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'unsupported' | 'dev'

export function UpdateSettingsCard() {
  const supported = typeof window !== 'undefined' && !!window.electronAPI?.checkForUpdates
  const [status, setStatus] = React.useState<Status>(supported ? 'idle' : 'unsupported')
  const [latestVersion, setLatestVersion] = React.useState<string>()
  const [progress, setProgress] = React.useState(0)
  const [errorMessage, setErrorMessage] = React.useState<string>()

  React.useEffect(() => {
    if (!window.electronAPI?.onUpdaterEvent) return
    return window.electronAPI.onUpdaterEvent((event) => {
      if (event.type === 'checking') setStatus('checking')
      if (event.type === 'available') {
        setStatus('available')
        setLatestVersion(event.version)
      }
      if (event.type === 'not-available') setStatus('not-available')
      if (event.type === 'progress') {
        setStatus('downloading')
        setProgress(event.percent)
      }
      if (event.type === 'downloaded') {
        setStatus('downloaded')
        setLatestVersion(event.version)
      }
      if (event.type === 'error') {
        setStatus('error')
        setErrorMessage(event.message)
      }
    })
  }, [])

  async function handleCheck() {
    if (!window.electronAPI?.checkForUpdates) return
    setStatus('checking')
    const result = await window.electronAPI.checkForUpdates()
    if (!result.ok && result.reason === 'not-packaged') setStatus('dev')
    else if (!result.ok) {
      setStatus('error')
      setErrorMessage(result.message)
    }
    // result.ok === true durumunda gerçek durum autoUpdater olaylarından (yukarıdaki
    // onUpdaterEvent aboneliği) gelecek — burada ayrıca bir şey set etmiyoruz.
  }

  function handleInstall() {
    window.electronAPI?.installUpdate()
  }

  return (
    <CollapsibleCard
      icon={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-black/5">
          <RefreshCw className="size-5" />
        </span>
      }
      title={
        <span className="flex items-center gap-2">
          Güncellemeler
          <Badge variant="secondary" className="font-mono font-normal">
            v{__APP_VERSION__}
          </Badge>
        </span>
      }
      description="Uygulama her açılışta yeni sürüm olup olmadığını arka planda otomatik kontrol eder. İsterseniz buradan da elle kontrol edebilirsiniz."
    >
      <div className="flex flex-wrap items-center gap-3">
        {status === 'unsupported' && (
          <p className="text-muted-foreground text-sm">Güncelleme kontrolü sadece kurulu masaüstü uygulamasında çalışır.</p>
        )}

        {status === 'dev' && (
          <p className="text-muted-foreground text-sm">
            Geliştirme modunda çalışıyorsunuz — burada kontrol edilecek bir güncelleme kaynağı yok.
          </p>
        )}

        {(status === 'idle' || status === 'not-available' || status === 'error') && supported && (
          <Button onClick={handleCheck} variant="outline">
            <RotateCw className="size-4" /> Güncellemeyi Kontrol Et
          </Button>
        )}

        {status === 'not-available' && (
          <span className="text-success flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4" /> Elinizdeki sürüm güncel
          </span>
        )}

        {status === 'checking' && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Loader2 className="size-4 animate-spin" /> Kontrol ediliyor...
          </span>
        )}

        {status === 'available' && (
          <span className="text-primary flex items-center gap-1.5 text-sm font-medium">
            <DownloadCloud className="size-4" /> Yeni sürüm bulundu (v{latestVersion}) — indiriliyor...
          </span>
        )}

        {status === 'downloading' && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Loader2 className="size-4 animate-spin" /> İndiriliyor: %{progress.toFixed(0)}
          </span>
        )}

        {status === 'downloaded' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-success flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 className="size-4" /> v{latestVersion} indirildi
            </span>
            <Button onClick={handleInstall}>
              <RefreshCw className="size-4" /> Şimdi Yeniden Başlat ve Kur
            </Button>
          </div>
        )}

        {status === 'error' && (
          <span className="text-destructive flex items-center gap-1.5 text-sm">
            <AlertTriangle className="size-4" /> Kontrol edilemedi{errorMessage ? `: ${errorMessage}` : ''}
          </span>
        )}
      </div>
    </CollapsibleCard>
  )
}
