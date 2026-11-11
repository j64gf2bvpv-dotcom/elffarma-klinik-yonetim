import * as React from 'react'
import { Loader2, Paperclip, X, FileText, ScanText } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { IMAGE_ACCEPT, ensureReadableImage, isImageFile } from '@/lib/ensureReadableImage'
import { getDocumentUrl, isPdfFile, isPdfPath, openDocument } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import { parseBillText, readBillText, type BillReadResult } from './readBill'

/** Kayıtlı (yolu olan) ya da yeni seçilmiş (Kaydet'te yüklenecek) fatura görüntüsü */
export type BillAttachment = { kind: 'saved'; path: string } | { kind: 'new'; file: File; url: string | null }

/**
 * Faturalar formundaki "Fatura Resmi" alanı (kullanıcı isteği, 2026-11-11): resim ya da PDF
 * eklenir; eklenen ilk dosya bilgisayarda okunup abone no / sözleşme no / abone adı forma yazılır.
 */
export function BillImageField({
  value,
  onChange,
  onRead,
}: {
  value: BillAttachment[]
  onChange: (next: BillAttachment[]) => void
  onRead: (found: BillReadResult) => void
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [reading, setReading] = React.useState(false)
  const [savedUrls, setSavedUrls] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    for (const a of value) {
      if (a.kind !== 'saved' || isPdfPath(a.path) || savedUrls[a.path]) continue
      getDocumentUrl(a.path)
        .then((url) => setSavedUrls((m) => ({ ...m, [a.path]: url })))
        .catch(() => {})
    }
  }, [value, savedUrls])

  async function read(file: File) {
    setReading(true)
    try {
      const found = parseBillText(await readBillText(file))
      const labels = [
        found.subscriber_number && 'abone no',
        found.contract_number && 'sözleşme no',
        found.subscriber_name && 'abone adı',
        found.amount && 'tutar',
        found.due_date && 'son ödeme tarihi',
      ].filter(Boolean)
      if (labels.length === 0) {
        toast.warning('Faturada bilgi bulunamadı', { description: 'Daha net bir resim deneyin ya da bilgileri elle yazın.' })
        return
      }
      onRead(found)
      toast.success('Faturadan okundu', { description: `${labels.join(', ')} forma yazıldı — lütfen kontrol edin.` })
    } catch (err) {
      toast.error('Fatura okunamadı', { description: getErrorMessage(err) })
    } finally {
      setReading(false)
    }
  }

  async function addFiles(files: Iterable<File>) {
    const list = Array.from(files)
    const picked = list.filter((f) => isImageFile(f) || isPdfFile(f))
    if (picked.length < list.length) toast.warning('Sadece resim ve PDF dosyaları eklenebilir')
    // HEIC (iPhone) vb. önizlemede görünsün diye JPEG'e çevrilir (2026-11-11)
    const ok: File[] = []
    for (const f of picked) {
      try {
        ok.push(isPdfFile(f) ? f : await ensureReadableImage(f))
      } catch (err) {
        toast.error(`${f.name} açılamadı`, { description: getErrorMessage(err) })
      }
    }
    if (ok.length === 0) return
    onChange([...value, ...ok.map((file): BillAttachment => ({ kind: 'new', file, url: isPdfFile(file) ? null : URL.createObjectURL(file) }))])
    void read(ok[0])
  }

  const firstNew = value.find((a): a is Extract<BillAttachment, { kind: 'new' }> => a.kind === 'new')

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Fatura Resmi</Label>
        {firstNew && !reading && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void read(firstNew.file)}>
            <ScanText /> Tekrar oku
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={`${IMAGE_ACCEPT},application/pdf,.pdf`}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((a, i) => {
            const pdf = a.kind === 'saved' ? isPdfPath(a.path) : isPdfFile(a.file)
            const url = a.kind === 'saved' ? savedUrls[a.path] : a.url
            return (
              <div key={a.kind === 'saved' ? a.path : `${a.file.name}-${i}`} className="relative h-24 overflow-hidden rounded-md border bg-background">
                <button
                  type="button"
                  className="h-full w-full"
                  title="Büyük görmek için tıklayın"
                  onClick={() => {
                    if (a.kind === 'saved') void openDocument(a.path, `Fatura ${i + 1}`).catch((err) => toast.error('Açılamadı', { description: getErrorMessage(err) }))
                    else if (a.url) window.open(a.url, '_blank')
                  }}
                >
                  {pdf || !url ? (
                    <span className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] text-muted-foreground">
                      {pdf ? <FileText className="size-6" /> : <Loader2 className="size-4 animate-spin" />}
                      {pdf && (a.kind === 'new' ? a.file.name : 'PDF')}
                    </span>
                  ) : (
                    <img src={url} alt={`Fatura ${i + 1}`} className="h-full w-full object-contain" />
                  )}
                </button>
                <button
                  type="button"
                  title="Kaldır"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1 hover:bg-destructive hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <button
        type="button"
        disabled={reading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(e.dataTransfer.files)
        }}
        className={`flex items-center justify-center gap-2 rounded-md border border-dashed py-3 text-sm text-muted-foreground hover:bg-accent ${
          dragging ? 'border-primary bg-primary/5' : ''
        }`}
      >
        {reading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        {reading ? 'Fatura okunuyor…' : 'Fatura resmi ya da PDF ekleyin — abone no, sözleşme no ve abone adı otomatik yazılır'}
      </button>
    </div>
  )
}
