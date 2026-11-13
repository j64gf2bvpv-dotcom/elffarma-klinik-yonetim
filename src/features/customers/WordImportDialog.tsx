import * as React from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { getErrorMessage } from '@/lib/utils'
import type { ImportSummary } from '@/lib/importData'
import type { Customer } from '@/types/database'
import { parseDoctorWord, type WordDoctorRow } from './parseDoctorWord'

type EditRow = WordDoctorRow & { key: number }

/**
 * Word'den (.docx) doktor aktarma (kullanıcı isteği, 2026-11-13: "içe aktar kısmında word ekleme
 * kısmı olsun, içerisindeki doktor ismi telefonu ve açıklama kısımlarını tek tek düzenli şekilde
 * programa girsin"). Yapay zekâ kullanmaz: tablo ya da satır satır yazılmış listeyi okur, her doktor
 * önizlemede ayrı satırda düzenlenebilir/çıkarılabilir; onaylanınca Cari Kart'a eklenir.
 */
export function WordImportDialog({
  open,
  onOpenChange,
  customers,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customers: Customer[]
  onImport: (rows: Record<string, unknown>[]) => Promise<ImportSummary>
}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<EditRow[]>([])
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const existingPhones = React.useMemo(() => new Set(customers.map((c) => c.phone)), [customers])
  const isRegistered = (phone: string) => {
    const n = phone ? normalizeTrPhone(phone) : null
    return !!n && existingPhones.has(n.canonical)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFileName(null)
      setRows([])
    }
    onOpenChange(next)
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const parsed = await parseDoctorWord(file)
      if (!parsed.length) {
        toast.error('Dosyada doktor bulunamadı', { description: 'Her doktor ayrı satırda ya da tabloda olmalı.' })
        return
      }
      setFileName(file.name)
      setRows(parsed.map((r, i) => ({ ...r, key: i })))
    } catch (err) {
      toast.error('Word dosyası okunamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const update = (key: number, patch: Partial<WordDoctorRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const ready = rows.filter((r) => r.name.trim() && !isRegistered(r.phone))

  async function handleConfirm() {
    setBusy(true)
    try {
      const summary = await onImport(ready.map((r) => ({ 'Ad Soyad': r.name.trim(), Telefon: r.phone.trim(), Açıklama: r.notes.trim() })))
      toast.success(`${summary.added} doktor Cari Kart'a eklendi`, {
        description: summary.skipped || summary.errors.length ? `${summary.skipped} atlandı, ${summary.errors.length} hata` : undefined,
      })
      if (summary.errors.length) toast.error(`${summary.errors.length} satırda hata`, { description: summary.errors.slice(0, 3).join(' • ') })
      handleOpenChange(false)
    } catch (err) {
      toast.error('Aktarılamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Word'den Doktor Aktar</DialogTitle>
          <DialogDescription>
            Word (.docx) dosyasındaki doktorların adı, telefonu ve açıklaması tek tek okunur. Kaydetmeden önce aşağıda kontrol edip düzeltebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />

        {!rows.length ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void pickFile(e.dataTransfer.files[0])
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-sm text-muted-foreground hover:bg-accent"
          >
            {busy ? <Loader2 className="size-8 animate-spin" /> : <FileText className="size-8" />}
            Word dosyasını seçmek için tıklayın ya da buraya sürükleyin
            <span className="text-xs">Tablo ya da "Dr. Ad Soyad - 0532 123 45 67 - açıklama" gibi satırlar okunur</span>
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <b>{fileName}</b> · {rows.length} doktor okundu · <b>{ready.length}</b> tanesi eklenecek
              </span>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                <Upload className="size-3.5" /> Başka dosya
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Doktor Adı</TableHead>
                    <TableHead className="w-44">Telefon</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const registered = isRegistered(r.phone)
                    return (
                      <TableRow key={r.key} className={registered ? 'opacity-60' : undefined}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} placeholder="Ad soyad gerekli" aria-invalid={!r.name.trim()} />
                          {registered && (
                            <Badge variant="secondary" className="mt-1">
                              Bu numara zaten kayıtlı — eklenmeyecek
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={r.phone} onChange={(e) => update(r.key, { phone: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input value={r.notes} onChange={(e) => update(r.key, { notes: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" title="Listeden çıkar" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={busy || !ready.length}>
            {busy && rows.length > 0 && <Loader2 className="animate-spin" />} {ready.length} Doktoru Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
