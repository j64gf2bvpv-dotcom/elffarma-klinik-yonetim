import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarRange, Globe, ImagePlus, Loader2, MapPin, Maximize2, Presentation } from 'lucide-react'
import { toast } from 'sonner'

import { SafeThumbnail } from '@/components/SafeThumbnail'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateRange } from '@/lib/dateRange'
import { placeholderColor } from '@/lib/placeholderColor'
import { cn } from '@/lib/utils'
import { extractImageFile } from './api'
import { useSetCongressImage } from './hooks'
import type { Congress } from '@/types/database'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'

/**
 * Kongre kartındaki küçük görsel — tıklayınca bilgisayardan görsel seçilir,
 * üzerine görsel sürükle-bırak yapılabilir ya da tıklayıp odaklandıktan sonra
 * kopyalanmış görsel Cmd+V ile yapıştırılabilir (kullanıcı isteği,
 * 2026-09-29: "kongrelerde workshoplarda görselleri ekleyebilmeliyiz").
 * Kart bir <Link> içinde olduğu için tıklama/sürükleme olayları
 * durduruluyor, yoksa kongre detayına gidilir.
 *
 * Görsel VARSA tıklayınca büyük önizleme açılır (kullanıcı isteği, 2026-10-23:
 * "küçük resimlere tıklayınca büyüsün, detayları görebilelim") — büyük görsel,
 * tarih, yer, açıklama, web sitesi; görseli değiştirme düğmesi de orada.
 * Sürükle-bırak / yapıştır ile değiştirme aynen çalışır.
 */
export function CongressImageDrop({ congress }: { congress: Congress }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const setImage = useSetCongressImage()
  const [previewOpen, setPreviewOpen] = React.useState(false)

  function upload(file: File | null | undefined) {
    if (!file) return
    if (!isImageFile(file)) {
      toast.error('Lütfen bir görsel dosyası seçin')
      return
    }
    setImage.mutate({ id: congress.id, file })
  }

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <span
      role="button"
      tabIndex={0}
      title={congress.image_url ? 'Büyütmek için tıklayın (değiştirmek için üzerine görsel sürükleyin)' : 'Görsel ekle (tıkla, sürükle-bırak veya yapıştır)'}
      onClick={(e) => {
        stop(e)
        if (congress.image_url) setPreviewOpen(true)
        else inputRef.current?.click()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          stop(e)
          if (congress.image_url) setPreviewOpen(true)
          else inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        stop(e)
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        stop(e)
        setDragOver(false)
        upload(extractImageFile(e.dataTransfer))
      }}
      onPaste={(e) => {
        const file = extractImageFile(e.clipboardData)
        if (file) {
          stop(e)
          upload(file)
        }
      }}
      className={cn(
        'group relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border text-white outline-none focus-visible:ring-2 focus-visible:ring-primary',
        dragOver && 'ring-2 ring-primary',
      )}
      style={congress.image_url ? undefined : { backgroundColor: placeholderColor(congress.name) }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {setImage.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <SafeThumbnail
          src={congress.image_url}
          alt={congress.name}
          className="size-full bg-muted object-contain p-1"
          fallback={<Presentation className="size-6" />}
        />
      )}
      {!setImage.isPending && (
        <span className="bg-background/90 text-foreground absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 py-0.5 text-[9px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {congress.image_url ? (
            <>
              <Maximize2 className="size-2.5" /> Büyüt
            </>
          ) : (
            <>
              <ImagePlus className="size-2.5" /> Ekle
            </>
          )}
        </span>
      )}
      {/* Önizleme portal'da açılsa da React olayları karttaki <Link>'e kabarcıklanır — burada durdurulur */}
      <span className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="pr-6 leading-snug">{congress.name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-4" />
                    {congress.start_date ? formatDateRange(congress.start_date, congress.end_date) : 'Tarih belirtilmedi'}
                  </span>
                  {(congress.city || congress.venue) && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {[congress.city, congress.venue].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            {congress.image_url && (
              <div className="flex justify-center rounded-lg border bg-muted/40 p-2">
                <img src={congress.image_url} alt={congress.name} className="max-h-[60vh] w-auto max-w-full rounded-md object-contain" />
              </div>
            )}
            {congress.summary && <p className="text-sm leading-relaxed">{congress.summary}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {congress.website_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={congress.website_url} target="_blank" rel="noreferrer">
                      <Globe className="size-4" /> Web sitesi
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={setImage.isPending}>
                  {setImage.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Görseli değiştir
                </Button>
              </div>
              <Button size="sm" asChild>
                <Link to={`/kongreler/${congress.id}`} onClick={() => setPreviewOpen(false)}>
                  Detaylar <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </span>
    </span>
  )
}
