import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileStack, Loader2, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageViewer } from '@/components/ImageViewer'
import { isPdfFile } from '@/lib/documentAttachments'
import { getErrorMessage } from '@/lib/utils'
import type { Personnel, PersonnelDocument } from '@/types/database'
import { savePersonnelDocument, updatePersonnel, uploadPersonnelAttachment } from './api'
import { ID_FIELD_LABELS, idFieldList, missingIdFields, parseIdInfo, type IdInfo } from './idInfo'
import { PERSONNEL_DOC_TYPES, docTypeLabel } from './docTypes'
import { trDate } from './status'
import { analyzePdf, extractPages, rotateDataUrl, type PdfPageInfo } from './splitPdf'

const SKIP = 'skip'
type Row = PdfPageInfo & { assigned: string }
type Group = { type: string; pages: Row[] }

/** Ardışık aynı türdeki sayfalar tek belge olur; "Alma" seçilen sayfalar atlanır */
function groupsOf(rows: Row[]): Group[] {
  const out: Group[] = []
  for (const r of rows) {
    if (r.assigned === SKIP) continue
    const last = out[out.length - 1]
    const prevRow = rows[r.index - 1]
    if (last && last.type === r.assigned && prevRow?.assigned === r.assigned) last.pages.push(r)
    else out.push({ type: r.assigned, pages: [r] })
  }
  return out
}

/**
 * Toplu PDF ile evrak ekleme: 8-10 sayfalık özlük PDF'i tek seferde yüklenir, sayfalar türüne göre ayrılıp ilgili
 * evrak satırlarına konur (kullanıcı isteği, 2026-11-17). Kayıttan önce her sayfanın türü önizlemede değiştirilebilir.
 * O türden evrak zaten varsa dosya ona eklenir (boş tarihleri doldurulur), yoksa yeni evrak açılır.
 */
export function PersonnelBulkPdfDialog({ personnelId, person, docs }: { personnelId: string; person?: Personnel; docs: PersonnelDocument[] }) {
  const [open, setOpen] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [rows, setRows] = React.useState<Row[]>([])
  const [progress, setProgress] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFile(null)
      setRows([])
      setProgress(null)
    }
    setOpen(next)
  }

  async function pick(f: File | undefined) {
    if (!f) return
    if (!isPdfFile(f)) {
      toast.error('PDF dosyası seçin')
      return
    }
    setFile(f)
    setRows([])
    setProgress('PDF açılıyor…')
    try {
      const pages = await analyzePdf(f, (done, total) => setProgress(`Sayfalar okunuyor… ${Math.min(done + 1, total)}/${total}`))
      // Türü bulunamayan sayfa önceki belgenin devamıdır (ör. iş sözleşmesinin 2. sayfası)
      const out: Row[] = []
      for (const p of pages) out.push({ ...p, assigned: p.type ?? out[out.length - 1]?.assigned ?? 'diger' })
      setRows(out)
    } catch (err) {
      toast.error('PDF okunamadı', { description: getErrorMessage(err) })
      setFile(null)
    } finally {
      setProgress(null)
    }
  }

  const groups = groupsOf(rows)

  // Kimlik/ehliyet/nüfus/askerlik/banka sayfalarından okunan bilgiler — kartta boş olan alanlara yazılır
  // (kullanıcı isteği, 2026-11-17: "kimlik kısımlarını da otomatik girsin bilgileri")
  const idInfo: IdInfo = {}
  if (person) {
    for (const r of rows) {
      if (r.assigned === SKIP) continue
      for (const [k, v] of Object.entries(parseIdInfo(r.text, r.assigned)) as [keyof IdInfo, string][]) idInfo[k] ??= v
    }
  }
  const newId = person ? missingIdFields(person, idInfo) : {}
  const hasNewId = Object.keys(newId).length > 0

  async function save() {
    if (!file || !groups.length) return
    setSaving(true)
    let added = 0
    try {
      for (const g of groups) {
        const first = g.pages[0].index + 1
        const last = g.pages[g.pages.length - 1].index + 1
        const range = first === last ? `sayfa ${first}` : `sayfa ${first}–${last}`
        const part = await extractPages(
          file,
          g.pages.map((p) => p.index),
          `${g.type}-${range.replace(/\s/g, '')}`,
          g.pages.map((p) => p.rotation),
        )
        const path = await uploadPersonnelAttachment(personnelId, part)
        const documentDate = g.pages.find((p) => p.dates.documentDate)?.dates.documentDate ?? null
        const validUntil = g.pages.find((p) => p.dates.validUntil)?.dates.validUntil ?? null
        const existing = g.type !== 'diger' ? docs.find((d) => d.doc_type === g.type) : undefined
        if (existing) {
          await savePersonnelDocument(existing.id, {
            personnel_id: existing.personnel_id,
            doc_type: existing.doc_type,
            title: existing.title,
            document_date: existing.document_date ?? documentDate,
            valid_until: existing.valid_until ?? validUntil,
            attachment_paths: [...existing.attachment_paths, path],
            note: existing.note,
          })
        } else {
          await savePersonnelDocument(undefined, {
            personnel_id: personnelId,
            doc_type: g.type,
            title: g.type === 'diger' ? `Toplu PDF ${range}` : null,
            document_date: documentDate,
            valid_until: validUntil,
            attachment_paths: [path],
            note: `Toplu PDF'ten (${file.name}, ${range})`,
          })
        }
        added++
      }
      if (person && hasNewId) await updatePersonnel(person.id, newId)
      await Promise.all([qc.invalidateQueries({ queryKey: ['personnel'] }), qc.invalidateQueries({ queryKey: ['personnel_documents'] })])
      toast.success(`${added} evrak yerine konuldu`, hasNewId ? { description: `Kimlik bilgileri karta işlendi: ${idFieldList(newId)}` } : undefined)
      handleOpenChange(false)
    } catch (err) {
      toast.error('Evraklar kaydedilemedi', { description: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)} title="Çok sayfalı özlük PDF'ini tek seferde ekleyin, sayfalar evraklara ayrılsın">
        <FileStack /> Toplu PDF Ekle
      </Button>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Toplu PDF ile Evrak Ekle</DialogTitle>
          <DialogDescription>
            Çok sayfalı PDF'i seçin; her sayfanın hangi evrak olduğu okunur ve sayfalar ilgili evrak satırlarına ayrılır. Kaydetmeden önce türleri kontrol edip
            değiştirebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />

        {!rows.length ? (
          <button
            type="button"
            disabled={!!progress}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void pick(e.dataTransfer.files[0])
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-sm text-muted-foreground hover:bg-accent"
          >
            {progress ? <Loader2 className="size-8 animate-spin" /> : <FileStack className="size-8" />}
            {progress ?? 'PDF dosyasını seçmek için tıklayın veya buraya sürükleyin'}
          </button>
        ) : (
          <>
            <p className="text-sm">
              <b>{file?.name}</b> · {rows.length} sayfa · <b>{groups.length}</b> evrak olarak kaydedilecek
            </p>
            {hasNewId && (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-xs">
                <b>Karta yazılacak kimlik bilgileri:</b>{' '}
                {(Object.entries(newId) as [keyof IdInfo, string][])
                  .map(([k, v]) => `${ID_FIELD_LABELS[k]}: ${k === 'birth_date' ? trDate(v) : v}`)
                  .join(' · ')}
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              {rows.map((r) => {
                const g = groups.find((x) => x.pages.includes(r))
                const isFirst = g?.pages[0] === r
                return (
                  <div key={r.index} className={`flex items-center gap-3 border-b p-2 last:border-b-0 ${isFirst ? '' : 'bg-muted/30'}`}>
                    <button type="button" title="Büyüt" onClick={() => setPreview(r.thumb)} className="shrink-0 overflow-hidden rounded border">
                      <img src={r.thumb} alt="" className="h-20 w-auto" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Sayfa {r.index + 1}
                        {r.rotation > 0 && <span className="ml-2 text-xs font-normal text-emerald-600">({r.rotation}° düzeltildi)</span>}
                        {!isFirst && r.assigned !== SKIP && <span className="ml-2 text-xs font-normal text-muted-foreground">(önceki sayfanın devamı)</span>}
                      </p>
                      {isFirst && (g?.pages.some((p) => p.dates.documentDate || p.dates.validUntil) ?? false) && (
                        <p className="text-xs text-muted-foreground">
                          {[
                            g?.pages.find((p) => p.dates.documentDate) && `Belge tarihi: ${trDate(g.pages.find((p) => p.dates.documentDate)!.dates.documentDate)}`,
                            g?.pages.find((p) => p.dates.validUntil) && `Geçerlilik: ${trDate(g.pages.find((p) => p.dates.validUntil)!.dates.validUntil)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      {isFirst && g && g.type !== 'diger' && docs.some((d) => d.doc_type === g.type) && (
                        <p className="text-xs text-amber-600">Bu evrak zaten var — dosya ona eklenecek</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Sayfayı döndür (yan/ters taranmışsa)"
                      onClick={() =>
                        void rotateDataUrl(r.thumb, 90).then((thumb) =>
                          setRows((rs) => rs.map((x) => (x.index === r.index ? { ...x, thumb, rotation: (x.rotation + 90) % 360 } : x))),
                        )
                      }
                    >
                      <RotateCw />
                    </Button>
                    <Select value={r.assigned} onValueChange={(v) => setRows((rs) => rs.map((x) => (x.index === r.index ? { ...x, assigned: v } : x)))}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSONNEL_DOC_TYPES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            {t.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="diger">{docTypeLabel('diger')}</SelectItem>
                        <SelectItem value={SKIP}>Alma (bu sayfayı ekleme)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <Button variant="ghost" className="mr-auto" onClick={() => inputRef.current?.click()} disabled={saving}>
              Başka PDF
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={() => void save()} disabled={saving || !groups.length}>
            {saving && <Loader2 className="animate-spin" />} {groups.length} Evrakı Kaydet
          </Button>
        </DialogFooter>
        <ImageViewer src={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Sayfa önizleme" />
      </DialogContent>
    </Dialog>
  )
}
