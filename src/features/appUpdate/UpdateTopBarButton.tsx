import * as React from 'react'
import { toast } from 'sonner'
import { RefreshCw, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

type Status = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'

/** TopBar'daki tek tıkla güncelleme butonu — Ayarlar > Güncellemeler kartıyla
 * (UpdateSettingsCard) aynı electronAPI olaylarını dinler, sadece ikon-only
 * kompakt biçimde. İndirilmiş bir güncelleme varken tıklamak doğrudan
 * yeniden başlatıp kurar. */
export function UpdateTopBarButton() {
  const supported = typeof window !== 'undefined' && !!window.electronAPI?.checkForUpdates
  const [status, setStatus] = React.useState<Status>('idle')
  const [latestVersion, setLatestVersion] = React.useState<string>()
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    if (!window.electronAPI?.onUpdaterEvent) return
    return window.electronAPI.onUpdaterEvent((event) => {
      if (event.type === 'checking') setStatus('checking')
      if (event.type === 'available') {
        setStatus('available')
        setLatestVersion(event.version)
        toast.info(`Yeni güncelleme bulundu (v${event.version})`, {
          description: 'İndiriliyor, hazır olunca ayrıca haber verilecek.',
        })
      }
      if (event.type === 'not-available') {
        setStatus('idle')
        toast.success('Elinizdeki sürüm güncel')
      }
      if (event.type === 'progress') {
        setStatus('downloading')
        setProgress(event.percent)
      }
      if (event.type === 'downloaded') {
        setStatus('downloaded')
        setLatestVersion(event.version)
        toast.success(`Güncelleme indirildi (v${event.version})`, {
          description: 'Kurmak için üstteki güncelleme simgesine tıklayın',
        })
      }
      if (event.type === 'error') {
        setStatus('error')
        toast.error('Güncelleme kontrol edilemedi')
      }
    })
  }, [])

  async function handleClick() {
    if (status === 'downloaded') {
      window.electronAPI?.installUpdate()
      return
    }
    if (status === 'checking' || status === 'downloading') return
    if (!window.electronAPI?.checkForUpdates) return
    setStatus('checking')
    const result = await window.electronAPI.checkForUpdates()
    if (!result.ok && result.reason === 'not-packaged') {
      setStatus('idle')
      toast.info('Geliştirme modunda güncelleme kontrolü yapılamaz')
    } else if (!result.ok) {
      setStatus('error')
      toast.error('Güncelleme kontrol edilemedi', { description: result.message })
    }
    // result.ok === true durumunda gerçek durum yukarıdaki onUpdaterEvent
    // aboneliğinden gelecek.
  }

  if (!supported) return null

  const label =
    status === 'checking'
      ? 'Güncelleme kontrol ediliyor...'
      : status === 'available'
        ? `Yeni sürüm bulundu (v${latestVersion}) — indiriliyor...`
        : status === 'downloading'
          ? `Güncelleme indiriliyor: %${progress.toFixed(0)}`
          : status === 'downloaded'
            ? `v${latestVersion} indirildi — kurmak için tıklayın`
            : status === 'error'
              ? 'Güncelleme kontrol edilemedi — tekrar denemek için tıklayın'
              : 'Güncellemeleri kontrol et'

  return (
    <div className="group relative flex">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'checking' || status === 'downloading'}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed',
          status === 'downloaded'
            ? 'text-success'
            : status === 'available' || status === 'downloading'
              ? 'text-primary'
              : status === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground',
        )}
      >
        {status === 'checking' || status === 'downloading' ? (
          <Loader2 className="size-[1.1rem] animate-spin" />
        ) : (
          <RefreshCw className="size-[1.1rem]" />
        )}
        {(status === 'available' || status === 'downloaded') && (
          <span className="bg-primary absolute top-1 right-1 size-2 animate-pulse rounded-full" />
        )}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 scale-95 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-md transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </div>
  )
}
