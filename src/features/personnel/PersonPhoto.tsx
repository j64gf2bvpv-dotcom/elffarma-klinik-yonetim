import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, UserRound, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ImageViewer } from '@/components/ImageViewer'
import { getDocumentUrl, removeDocuments } from '@/lib/documentAttachments'
import { IMAGE_ACCEPT, ensureReadableImage } from '@/lib/ensureReadableImage'
import { cn, getErrorMessage } from '@/lib/utils'
import { updatePersonnel, uploadPersonnelPhoto } from './api'

/**
 * Personelin vesikalık fotoğrafı (yoksa simge). `personnelId` verilirse tıklayınca küçük resim seçilip doğrudan
 * yüklenir — monogram/logo yerine (kullanıcı isteği, 2026-11-17: "küçük resim ekleyebileyim logo yerine").
 */
export function PersonPhoto({ path, className, personnelId }: { path: string | null; className?: string; personnelId?: string }) {
  const { data: url } = useQuery({
    queryKey: ['doc-url', path],
    queryFn: () => getDocumentUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 8,
  })
  const qc = useQueryClient()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [viewing, setViewing] = React.useState(false)

  async function change(file: File | undefined) {
    if (!file || !personnelId) return
    setBusy(true)
    try {
      const readable = await ensureReadableImage(file)
      const newPath = await uploadPersonnelPhoto(personnelId, readable)
      await updatePersonnel(personnelId, { photo_path: newPath })
      if (path) void removeDocuments([path]).catch(() => {})
      await qc.invalidateQueries({ queryKey: ['personnel'] })
      toast.success('Fotoğraf güncellendi')
    } catch (err) {
      toast.error('Fotoğraf yüklenemedi', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const box = cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40', className)
  const content = url ? <img src={url} alt="" className="size-full object-cover" /> : <UserRound className="size-1/2 text-muted-foreground" />
  if (!personnelId) return <span className={box}>{content}</span>
  return (
    <>
      <button
        type="button"
        title={url ? 'Büyüt' : 'Fotoğraf ekle'}
        className={cn(box, 'group cursor-pointer')}
        onClick={(e) => {
          e.stopPropagation()
          // Fotoğraf varsa tam ekranda açılır (yakınlaştırılabilir), yoksa fotoğraf seçilir
          if (url) setViewing(true)
          else inputRef.current?.click()
        }}
      >
        {content}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {url ? <ZoomIn className="size-1/3" /> : <Camera className="size-1/3" />}
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
            <Loader2 className="size-1/3 animate-spin" />
          </span>
        )}
      </button>
      <span onClick={(e) => e.stopPropagation()} className="contents">
        <ImageViewer
          key={String(viewing)}
          src={url ?? null}
          open={viewing}
          onOpenChange={setViewing}
          title="Fotoğraf"
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                setViewing(false)
                inputRef.current?.click()
              }}
            >
              <Camera /> Fotoğrafı değiştir
            </Button>
          }
        />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          void change(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
