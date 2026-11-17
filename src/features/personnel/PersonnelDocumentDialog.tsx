import * as React from 'react'
import { Loader2, Paperclip, X, FileText } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IMAGE_ACCEPT, ensureReadableImage, isImageFile } from '@/lib/ensureReadableImage'
import { getDocumentUrl, isPdfFile, isPdfPath } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import type { Personnel, PersonnelDocument } from '@/types/database'
import { useQueryClient } from '@tanstack/react-query'
import { updatePersonnel, uploadPersonnelAttachment } from './api'
import { idFieldList, missingIdFields, parseIdInfo } from './idInfo'
import { readDocDates } from './readDocDates'
import { DOC_TYPE_BY_KEY, PERSONNEL_DOC_TYPES } from './docTypes'
import { useSavePersonnelDocument } from './hooks'

type Attachment = { kind: 'saved'; path: string; url: string | null } | { kind: 'new'; file: File; url: string | null }

/** Personel evrakı ekle / düzenle — tür, tarih, geçerlilik, not ve resim/PDF dosyaları (2026-11-12) */
export function PersonnelDocumentDialog({
  personnelId,
  person,
  doc,
  defaultType,
  trigger,
}: {
  personnelId: string
  /** Verilirse belgeden okunan kimlik bilgileri kişinin kartındaki boş alanlara yazılır */
  person?: Personnel
  doc?: PersonnelDocument
  defaultType?: string
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [docType, setDocType] = React.useState('diger')
  const [title, setTitle] = React.useState('')
  const [docDate, setDocDate] = React.useState('')
  const [validUntil, setValidUntil] = React.useState('')
  const [note, setNote] = React.useState('')
  const [files, setFiles] = React.useState<Attachment[]>([])
  const [saving, setSaving] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [readingDates, setReadingDates] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const save = useSavePersonnelDocument()
  const qc = useQueryClient()
  // Eklenen dosyaların metni — kayıtta kimlik bilgileri bundan okunur
  const readTexts = React.useRef<string[]>([])

  function handleOpenChange(next: boolean) {
    if (next) {
      setDocType(doc?.doc_type ?? defaultType ?? 'diger')
      setTitle(doc?.title ?? '')
      setDocDate(doc?.document_date ?? '')
      setValidUntil(doc?.valid_until ?? '')
      setNote(doc?.note ?? '')
      readTexts.current = []
      const saved: Attachment[] = (doc?.attachment_paths ?? []).map((path) => ({ kind: 'saved', path, url: null }))
      setFiles(saved)
      for (const a of saved) {
        if (a.kind !== 'saved' || isPdfPath(a.path)) continue
        getDocumentUrl(a.path)
          .then((url) => setFiles((prev) => prev.map((x) => (x.kind === 'saved' && x.path === a.path ? { ...x, url } : x))))
          .catch(() => {})
      }
    }
    setOpen(next)
  }

  /**
   * Dosyadaki belge tarihi ve geçerlilik tarihi boş alanlara yazılır (kullanıcı isteği, 2026-11-17: "özlük dosyasını
   * koyduğumda içinde varsa belge tarihi ve geçerlilik tarihi olsun"). Elle girilmiş tarihin üzerine yazılmaz.
   */
  async function fillDatesFrom(file: File) {
    if (docDate && validUntil && !person) return
    setReadingDates(true)
    try {
      const found = await readDocDates(file)
      readTexts.current.push(found.text)
      if (found.documentDate) setDocDate((cur) => cur || found.documentDate!)
      if (found.validUntil) setValidUntil((cur) => cur || found.validUntil!)
      if (found.documentDate || found.validUntil) toast.success('Tarihler belgeden okundu', { description: 'Kontrol edip gerekirse düzeltin.' })
    } catch {
      // Okunamazsa tarihler elle girilir
    } finally {
      setReadingDates(false)
    }
  }

  /**
   * Kimlik/ehliyet/nüfus/askerlik/banka belgesindeki bilgiler kişinin kartındaki boş alanlara yazılır
   * (kullanıcı isteği, 2026-11-17: "kimlik kısımlarını da otomatik girsin bilgileri"). Dolu alanlara dokunulmaz.
   */
  async function fillIdentity() {
    if (!person || !readTexts.current.length) return
    const info = missingIdFields(person, parseIdInfo(readTexts.current.join('\n'), docType))
    if (!Object.keys(info).length) return
    try {
      await updatePersonnel(person.id, info)
      await qc.invalidateQueries({ queryKey: ['personnel'] })
      toast.success('Kimlik bilgileri karta işlendi', { description: idFieldList(info) })
    } catch {
      // Kimlik bilgisi yazılamazsa evrak yine de kaydedilmiştir
    }
  }

  async function addFiles(list: Iterable<File>) {
    const all = Array.from(list)
    let firstNew: File | null = null
    for (const f of all) {
      if (!isImageFile(f) && !isPdfFile(f)) {
        toast.warning(`${f.name}: sadece resim ve PDF eklenebilir`)
        continue
      }
      try {
        // HEIC (iPhone) önizlemede görünsün diye JPEG'e çevrilir
        const file = isPdfFile(f) ? f : await ensureReadableImage(f)
        setFiles((prev) => [...prev, { kind: 'new', file, url: isPdfFile(file) ? null : URL.createObjectURL(file) }])
        firstNew ??= file
      } catch (err) {
        toast.error(`${f.name} açılamadı`, { description: getErrorMessage(err) })
      }
    }
    if (firstNew) await fillDatesFrom(firstNew)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (docType === 'diger' && !title.trim()) {
      toast.error('Evrakın adını yazın')
      return
    }
    setSaving(true)
    try {
      const paths: string[] = []
      for (const a of files) paths.push(a.kind === 'saved' ? a.path : await uploadPersonnelAttachment(personnelId, a.file))
      await save.mutateAsync({
        id: doc?.id,
        input: {
          personnel_id: personnelId,
          doc_type: docType,
          title: docType === 'diger' ? title.trim() : null,
          document_date: docDate || null,
          valid_until: validUntil || null,
          attachment_paths: paths,
          note: note.trim() || null,
        },
      })
      await fillIdentity()
      setOpen(false)
    } catch (err) {
      toast.error('Kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const expires = DOC_TYPE_BY_KEY.get(docType)?.expires

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{doc ? 'Evrakı Düzenle' : 'Evrak Ekle'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Evrak</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {PERSONNEL_DOC_TYPES.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
                <SelectItem value="diger">Diğer (adını yazın)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {docType === 'diger' && (
            <div className="grid gap-1.5">
              <Label htmlFor="pd-title">Evrakın Adı</Label>
              <Input id="pd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ör. Referans mektubu" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pd-date" className="flex items-center gap-1.5">
                Belge Tarihi {readingDates && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </Label>
              <Input id="pd-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pd-valid">Geçerlilik Tarihi{expires ? '' : ' (varsa)'}</Label>
              <Input id="pd-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pd-note">Not</Label>
            <Input id="pd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
          </div>
          <div className="grid gap-2">
            <Label>Dosyalar</Label>
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
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((a, i) => {
                  const pdf = a.kind === 'saved' ? isPdfPath(a.path) : isPdfFile(a.file)
                  return (
                    <div key={a.kind === 'saved' ? a.path : `${a.file.name}-${i}`} className="relative h-24 overflow-hidden rounded-md border bg-background">
                      {pdf || !a.url ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] text-muted-foreground">
                          {pdf ? <FileText className="size-6" /> : <Loader2 className="size-4 animate-spin" />}
                          {pdf && (a.kind === 'new' ? a.file.name : 'PDF')}
                        </div>
                      ) : (
                        <img src={a.url} alt={`Dosya ${i + 1}`} className="h-full w-full object-contain" />
                      )}
                      <button
                        type="button"
                        title="Kaldır"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
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
              className={`flex items-center justify-center gap-2 rounded-md border border-dashed py-4 text-sm text-muted-foreground hover:bg-accent ${dragging ? 'border-primary bg-primary/5' : ''}`}
            >
              <Paperclip className="size-4" /> Evrakın resmini ya da PDF'ini ekleyin (tıklayın veya sürükleyin)
            </button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
