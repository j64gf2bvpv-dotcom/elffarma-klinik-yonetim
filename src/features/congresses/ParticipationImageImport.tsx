import * as React from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { FileText, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAIService } from '@/features/ai/useAIService'
import { formatDateRange } from '@/lib/dateRange'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'
import { getErrorMessage } from '@/lib/utils'
import { extractImageFile } from './api'
import {
  PARTICIPATION_LABELS,
  aiParseParticipation,
  parseParticipationText,
  readImageText,
  uploadParticipationImage,
  type ParticipationField,
  type ParticipationInfo,
} from './participationInfo'

const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

/**
 * Kongre formunda "Katılım bilgileri görseli" (kullanıcı isteği, 2026-10-28) —
 * fiyat / konaklama / kayıt koşulları afişi yüklenir (tıkla, sürükle-bırak,
 * yapıştır); yazılar bilgisayarda okunup bulunan bilgiler işaretlenerek forma
 * aktarılır. "Yapay zekâ ile ayrıntılı oku" isteğe bağlı (1 istek).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ParticipationImageImport({ form }: { form: UseFormReturn<any, unknown, any> }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const aiService = useAIService()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [text, setText] = React.useState('')
  const [found, setFound] = React.useState<ParticipationInfo | null>(null)
  const [picked, setPicked] = React.useState<Set<ParticipationField>>(new Set())
  const [dragOver, setDragOver] = React.useState(false)
  const imageUrl: string = form.watch('participation_image_url') ?? ''

  function showFound(info: ParticipationInfo) {
    const keys = (Object.keys(PARTICIPATION_LABELS) as ParticipationField[]).filter((k) => info[k] != null && info[k] !== '')
    setFound(info)
    // Formda boş olan alanlar varsayılan seçili; dolu olanlar üzerine yazılmasın diye seçili gelmez
    setPicked(new Set(keys.filter((k) => k === 'notes' || !form.getValues(k))))
    if (keys.length <= 1) toast.info('Görselde kongre bilgisi bulunamadı', { description: 'Metin okundu; isterseniz nota ekleyebilir ya da "Yapay zekâ ile ayrıntılı oku"yu deneyebilirsiniz.' })
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return
    if (!isImageFile(file)) return toast.error('Lütfen bir görsel dosyası seçin')
    setFound(null)
    try {
      setBusy('Görsel yükleniyor…')
      const url = await uploadParticipationImage(file)
      form.setValue('participation_image_url', url, { shouldDirty: true })
      setBusy('Yazılar okunuyor…')
      const t = await readImageText(file)
      setText(t)
      if (!t.trim()) {
        toast.warning('Görselde okunabilir yazı bulunamadı')
        return
      }
      showFound(parseParticipationText(t))
    } catch (err) {
      toast.error('Görsel okunamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  async function aiRead() {
    if (!text.trim()) return
    setBusy('Yapay zekâ okuyor…')
    try {
      const ai = await aiParseParticipation(aiService, form.getValues('name') || 'Kongre', text)
      const local = parseParticipationText(text)
      showFound({ ...local, ...ai, notes: local.notes })
    } catch (err) {
      toast.error('Yapay zekâ okuyamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  function apply() {
    if (!found) return
    let n = 0
    for (const k of picked) {
      const v = found[k]
      if (v == null || v === '') continue
      if (k === 'notes') {
        const current: string = form.getValues('notes') ?? ''
        const block = `Katılım bilgileri (görselden):\n${v}`
        if (!current.includes(block)) form.setValue('notes', current ? `${current}\n\n${block}` : block, { shouldDirty: true })
      } else form.setValue(k, v, { shouldDirty: true })
      n++
    }
    toast.success(`${n} bilgi forma aktarıldı`, { description: 'Kaydetmek için "Kaydet"e basın.' })
    setFound(null)
  }

  const show = (k: ParticipationField, v: string | number) =>
    k === 'start_date' || k === 'end_date'
      ? formatDateRange(String(v))
      : k === 'single_person_price' || k === 'two_person_price'
        ? money(Number(v))
        : k === 'notes'
          ? `${String(v).split('\n').length} satır`
          : String(v)

  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Katılım bilgileri görseli (opsiyonel)</span>
        <div className="flex gap-1.5">
          {text && (
            <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => void aiRead()} title="Okunan metni yapay zekâya yapılandırtır — 1 istek harcar">
              <Sparkles className="size-3.5" /> Yapay zekâ ile ayrıntılı oku
            </Button>
          )}
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!!busy}
              onClick={() => {
                form.setValue('participation_image_url', '', { shouldDirty: true })
                setText('')
                setFound(null)
              }}
            >
              <X className="size-3.5" /> Kaldır
            </Button>
          )}
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFile(extractImageFile(e.dataTransfer))
        }}
        onPaste={(e) => {
          const f = extractImageFile(e.clipboardData)
          if (f) {
            e.preventDefault()
            void handleFile(f)
          }
        }}
        className={`flex min-h-24 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed bg-muted/30 p-2 text-sm text-muted-foreground outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary ${dragOver ? 'ring-2 ring-primary' : ''}`}
        title="Fiyat / konaklama / kayıt bilgilerini gösteren görseli seçin, sürükleyip bırakın ya da yapıştırın — yazılar okunup forma aktarılır"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> {busy}
          </span>
        ) : imageUrl ? (
          <>
            <img src={imageUrl} alt="Katılım bilgileri" className="max-h-40 rounded border object-contain" />
            <span className="text-xs">
              Değiştirmek için tıklayın / sürükleyin
              {!text && (
                <>
                  <br />
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={async (e) => {
                      e.stopPropagation()
                      setBusy('Yazılar okunuyor…')
                      try {
                        const blob = await (await fetch(imageUrl)).blob()
                        const t = await readImageText(new File([blob], 'katilim.jpg', { type: blob.type || 'image/jpeg' }))
                        setText(t)
                        if (t.trim()) showFound(parseParticipationText(t))
                        else toast.warning('Görselde okunabilir yazı bulunamadı')
                      } catch (err) {
                        toast.error('Görsel okunamadı', { description: getErrorMessage(err) })
                      } finally {
                        setBusy(null)
                      }
                    }}
                  >
                    <FileText className="size-3" /> Görseldeki bilgileri tekrar oku
                  </button>
                </>
              )}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2">
            <ImagePlus className="size-5" /> Katılım/fiyat afişini seçin, sürükleyin ya da yapıştırın — bilgiler okunup forma yazılır
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {found && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-2 font-medium">Görselde bulunan bilgiler — forma aktarmak istediklerinizi işaretleyin:</p>
          <div className="grid gap-1.5">
            {(Object.keys(PARTICIPATION_LABELS) as ParticipationField[])
              .filter((k) => found[k] != null && found[k] !== '')
              .map((k) => (
                <label key={k} className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={picked.has(k)}
                    onCheckedChange={(v) =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (v === true) next.add(k)
                        else next.delete(k)
                        return next
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="text-muted-foreground">{PARTICIPATION_LABELS[k]}: </span>
                    <span className="break-words">{show(k, found[k]!)}</span>
                    {k !== 'notes' && form.getValues(k) ? <span className="text-muted-foreground"> (formda dolu — işaretlerseniz değişir)</span> : null}
                  </span>
                </label>
              ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setFound(null)}>
              Vazgeç
            </Button>
            <Button type="button" size="sm" onClick={apply} disabled={picked.size === 0}>
              Seçilenleri forma aktar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
