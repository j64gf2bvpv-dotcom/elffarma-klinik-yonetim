import * as React from 'react'
import { ImagePlus, Loader2, Presentation } from 'lucide-react'
import { toast } from 'sonner'

import { SafeThumbnail } from '@/components/SafeThumbnail'
import { placeholderColor } from '@/lib/placeholderColor'
import { cn } from '@/lib/utils'
import { extractImageFile } from './api'
import { useSetCongressImage } from './hooks'
import type { Congress } from '@/types/database'

/**
 * Kongre kartındaki küçük görsel — tıklayınca bilgisayardan görsel seçilir,
 * üzerine görsel sürükle-bırak yapılabilir ya da tıklayıp odaklandıktan sonra
 * kopyalanmış görsel Cmd+V ile yapıştırılabilir (kullanıcı isteği,
 * 2026-09-29: "kongrelerde workshoplarda görselleri ekleyebilmeliyiz").
 * Kart bir <Link> içinde olduğu için tıklama/sürükleme olayları
 * durduruluyor, yoksa kongre detayına gidilir.
 */
export function CongressImageDrop({ congress }: { congress: Congress }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const setImage = useSetCongressImage()

  function upload(file: File | null | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
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
      title={congress.image_url ? 'Görseli değiştir (tıkla, sürükle-bırak veya yapıştır)' : 'Görsel ekle (tıkla, sürükle-bırak veya yapıştır)'}
      onClick={(e) => {
        stop(e)
        inputRef.current?.click()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          stop(e)
          inputRef.current?.click()
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
        accept="image/*"
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
          <ImagePlus className="size-2.5" /> {congress.image_url ? 'Değiştir' : 'Ekle'}
        </span>
      )}
    </span>
  )
}
