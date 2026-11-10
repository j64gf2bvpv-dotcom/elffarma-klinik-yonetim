import * as React from 'react'
import { Camera, ImagePlus, ScanLine, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'
import { getErrorMessage } from '@/lib/utils'

/** Ön + arka yüz */
const MAX_SHOTS = 2

/**
 * "Ruhsat Tara" (kullanıcı isteği, 2026-11-10): ruhsat fotoğrafını dosyadan seç,
 * sürükle-bırak, panodan yapıştır (Ctrl/Cmd+V) ya da bilgisayarın kamerasıyla çek.
 * Fotoğraflar seçilince araç formu açılır ve bilgiler bilgisayarda okunup doldurulur
 * (hiçbir yapay zekâ servisine gönderilmez — bkz. ruhsatOcr.ts).
 */
export function RuhsatScanDialog({ onScan }: { onScan: (files: File[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [shots, setShots] = React.useState<{ file: File; url: string }[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [camera, setCamera] = React.useState<'off' | 'starting' | 'on'>('off')
  const fileRef = React.useRef<HTMLInputElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamera('off')
  }, [])

  const addFiles = React.useCallback((files: Iterable<File>) => {
    const picked = Array.from(files).filter(isImageFile)
    if (picked.length === 0) {
      toast.warning('Resim dosyası seçilmedi', { description: 'Ruhsatın fotoğrafını ya da taranmış resmini seçin.' })
      return
    }
    setShots((prev) => {
      const next = [...prev, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]
      for (const s of next.slice(MAX_SHOTS)) URL.revokeObjectURL(s.url)
      return next.slice(0, MAX_SHOTS)
    })
  }, [])

  function reset() {
    stopCamera()
    setShots((prev) => {
      for (const s of prev) URL.revokeObjectURL(s.url)
      return []
    })
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset()
    setOpen(o)
  }

  // Panodan yapıştırma — pencere açıkken Ctrl/Cmd+V
  React.useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) {
        e.preventDefault()
        addFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open, addFiles])

  React.useEffect(() => stopCamera, [stopCamera])

  async function startCamera() {
    setCamera('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 3840 }, height: { ideal: 2160 }, facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setCamera('on')
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch (err) {
      setCamera('off')
      toast.error('Kamera açılamadı', {
        description:
          (err as DOMException)?.name === 'NotAllowedError'
            ? 'Kamera izni verilmedi — Sistem Ayarları > Gizlilik > Kamera bölümünden programa izin verin.'
            : (err as DOMException)?.name === 'NotFoundError'
              ? 'Bu bilgisayarda kamera bulunamadı.'
              : getErrorMessage(err),
      })
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        addFiles([new File([blob], `ruhsat-kamera-${Date.now()}.jpg`, { type: 'image/jpeg' })])
        if (shots.length + 1 >= MAX_SHOTS) stopCamera()
      },
      'image/jpeg',
      0.95,
    )
  }

  function submit() {
    if (shots.length === 0) return
    const files = shots.map((s) => s.file)
    reset()
    setOpen(false)
    onScan(files)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ScanLine /> Ruhsat Tara
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ruhsat Tara</DialogTitle>
          <DialogDescription>
            Ruhsatın fotoğrafını ya da tarayıcıdan çıkan resmini ekleyin (ön ve arka yüz için 2 resim). Plaka, model, şase, tescil
            ve muayene bilgileri okunup araç formuna doldurulur.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {camera !== 'off' ? (
          <div className="grid gap-2">
            <div className="relative overflow-hidden rounded-lg border bg-black">
              <video ref={videoRef} muted playsInline className="aspect-video w-full object-contain" />
              {camera === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Kamera açılıyor…
                </div>
              )}
              {/* Ruhsatı hizalamak için çerçeve */}
              <div className="pointer-events-none absolute inset-[8%] rounded-md border-2 border-dashed border-white/60" />
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={stopCamera}>
                Vazgeç
              </Button>
              <Button type="button" onClick={capture} disabled={camera !== 'on'}>
                <Camera /> Çek {shots.length > 0 ? '(arka yüz)' : ''}
              </Button>
            </div>
          </div>
        ) : (
          shots.length < MAX_SHOTS && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              className={`grid place-items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <ScanLine className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {shots.length === 0 ? 'Ruhsat resmini buraya sürükleyin ya da yapıştırın (Ctrl+V)' : 'Arka yüzü de ekleyebilirsiniz (isteğe bağlı)'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus /> Dosyadan seç
                </Button>
                <Button type="button" variant="outline" onClick={() => void startCamera()}>
                  <Camera /> Kamerayla çek
                </Button>
              </div>
            </div>
          )
        )}

        {shots.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {shots.map((s, i) => (
              <div key={s.url} className="relative overflow-hidden rounded-md border">
                <img src={s.url} alt={i === 0 ? 'Ön yüz' : 'Arka yüz'} className="h-32 w-full bg-background object-contain" />
                <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px]">
                  {i === 0 ? 'Ön yüz' : 'Arka yüz'}
                </span>
                <button
                  type="button"
                  title="Kaldır"
                  onClick={() =>
                    setShots((prev) => {
                      URL.revokeObjectURL(s.url)
                      return prev.filter((x) => x !== s)
                    })
                  }
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1 hover:bg-destructive hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" onClick={submit} disabled={shots.length === 0}>
            <ScanLine /> Ruhsatı Oku
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
