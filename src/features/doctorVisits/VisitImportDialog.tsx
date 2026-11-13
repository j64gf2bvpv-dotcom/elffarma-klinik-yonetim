import * as React from 'react'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadExcelTemplate, readExcelFile } from '@/lib/importData'
import { getErrorMessage } from '@/lib/utils'
import { parseDoctorWord } from '@/features/customers/parseDoctorWord'
import { IMAGE_ACCEPT, isImageFile } from '@/lib/ensureReadableImage'
import { readVisitImage } from './readVisitImage'
import type { Customer, DoctorVisit, SalesRep } from '@/types/database'
import { createVisit } from './api'

interface ImportRow {
  key: number
  doctor_name: string
  phone: string
  notes: string
  visit_date: string
}

const TEMPLATE_HEADERS = ['Tarih', 'Doktor', 'Telefon', 'Açıklama']
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()

/** Excel satırında başlığı büyük/küçük harf ve boşluk farkını önemsemeden bulur */
function pick(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const wanted = aliases.map(fold)
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(fold(k)) && v != null && String(v).trim() !== '') return v
  }
  return undefined
}

/** Excel tarihi (seri numara, 13.11.2026, 2026-11-13) → yyyy-MM-dd */
function toDateKey(v: unknown): string | null {
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 864e5))
    return d.toISOString().slice(0, 10)
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/**
 * Haftalık Satış Temsilcisi Raporu'na içe aktarma (kullanıcı isteği, 2026-11-13). Her temsilcinin
 * kartında kendi düğmesi var ("içe aktar kısmı personeller için tek tek olsun"): Word (.docx) ya da
 * Excel dosyasındaki doktorlar (ad, telefon, açıklama) önizlemede tek tek gösterilir, her satırın
 * günü seçilebilir (Excel'de Tarih sütunu varsa oradan gelir). Onaylanınca O TEMSİLCİNİN listesine
 * eklenir; Cari Kart'taki doktorla birebir aynı isim karta bağlanır.
 */
export function VisitImportDialog({
  rep,
  days,
  visits,
  customers,
}: {
  rep: SalesRep
  days: Date[]
  visits: DoctorVisit[]
  customers: Customer[]
}) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ImportRow[]>([])
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const dayKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  function handleOpenChange(next: boolean) {
    if (next) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setDate(dayKeys.includes(today) ? today : dayKeys[0])
      setFileName(null)
      setRows([])
    }
    setOpen(next)
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      let parsed: Omit<ImportRow, 'key'>[]
      if (/\.docx$/i.test(file.name)) {
        parsed = (await parseDoctorWord(file)).map((r) => ({
          doctor_name: r.name,
          phone: r.phone,
          notes: r.notes,
          visit_date: date,
        }))
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        parsed = (await readExcelFile(file))
          .map((row) => ({
            doctor_name: String(pick(row, 'Doktor', 'Doktor Adı', 'Ad Soyad', 'Adı Soyadı', 'İsim', 'Ad') ?? '').trim(),
            phone: String(pick(row, 'Telefon', 'Tel', 'GSM', 'Cep', 'Cep Telefonu') ?? '').trim(),
            notes: String(pick(row, 'Açıklama', 'Not', 'Notlar', 'Aciklama') ?? '').trim(),
            visit_date: toDateKey(pick(row, 'Tarih', 'Ziyaret Tarihi', 'Gün')) ?? date,
          }))
          .filter((r) => r.doctor_name || r.phone)
      } else if (isImageFile(file)) {
        // Resim: yazı tanımayla okunur; gün başlığı/tarih varsa o gün, yoksa seçili gün
        parsed = (await readVisitImage(file, days, rep.name)).map((r) => ({
          doctor_name: r.name,
          phone: r.phone,
          notes: r.notes,
          visit_date: r.date ?? date,
        }))
      } else {
        throw new Error('Word (.docx), Excel (.xlsx) ya da resim dosyası seçin.')
      }
      if (!parsed.length) {
        toast.error('Dosyada doktor bulunamadı')
        return
      }
      setFileName(file.name)
      setRows(parsed.map((r, i) => ({ ...r, key: i })))
    } catch (err) {
      toast.error('Dosya okunamadı', { description: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const update = (key: number, patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const applyToAll = (patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => ({ ...r, ...patch })))

  const isDuplicate = (r: ImportRow) =>
    visits.some((v) => v.sales_rep_id === rep.id && v.visit_date === r.visit_date && fold(v.doctor_name) === fold(r.doctor_name))
  const ready = rows.filter((r) => r.doctor_name.trim() && r.visit_date && !isDuplicate(r))

  async function handleConfirm() {
    setBusy(true)
    let added = 0
    const errors: string[] = []
    try {
      for (const r of ready) {
        const name = r.doctor_name.trim()
        const customer = customers.find((c) => fold(c.full_name) === fold(name))
        try {
          await createVisit({
            visit_date: r.visit_date,
            sales_rep_id: rep.id,
            doctor_name: customer?.full_name ?? name,
            customer_id: customer?.id ?? null,
            phone: r.phone.trim() || customer?.phone || null,
            notes: r.notes.trim() || null,
          })
          added++
        } catch (err) {
          errors.push(`${name}: ${getErrorMessage(err)}`)
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      void queryClient.invalidateQueries({ queryKey: ['doctor_visit_dates'] })
      const otherWeek = ready.filter((r) => !dayKeys.includes(r.visit_date)).length
      if (added)
        toast.success(`${added} doktor ${rep.name} listesine eklendi`, {
          description: otherWeek ? `${otherWeek} tanesi başka haftada — o haftayı seçince görünür.` : undefined,
        })
      if (errors.length) toast.error(`${errors.length} doktor eklenemedi`, { description: errors.slice(0, 3).join(' • ') })
      if (!errors.length) setOpen(false)
    } finally {
      setBusy(false)
    }
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="ghost" size="icon" className="size-8" title={`İçe Aktar — ${rep.name} listesine Word/Excel'den doktor ekle`} onClick={() => handleOpenChange(true)}>
        <Upload className="size-4" />
      </Button>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{rep.name} — Doktor İçe Aktar</DialogTitle>
          <DialogDescription>
            Word, Excel ya da resimdeki doktorların adı, telefonu ve açıklaması tek tek okunur ve {rep.name} listesine eklenir. Resimde gün yazıyorsa gün de oradan alınır; kontrol edip kaydedin.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept={`.docx,.xlsx,.xls,.csv,${IMAGE_ACCEPT}`}
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ''))}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Tarih</Label>
            <Input
              type="date"
              className="w-44"
              value={date}
              onChange={(e) => {
                if (!e.target.value) return
                setDate(e.target.value)
                applyToAll({ visit_date: e.target.value })
              }}
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">Eski ya da ileri bir tarih de seçebilirsiniz. Değiştirince bütün doktorlara uygulanır; her doktorun tarihini satırından da değiştirebilirsiniz.</p>
        </div>

        {!rows.length ? (
          <div className="grid gap-2">
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
              Word, Excel ya da resim (fotoğraf, ekran görüntüsü) seçmek için tıklayın veya buraya sürükleyin
              <span className="text-xs">Word/resim: tablo ya da "Dr. Ad Soyad - 0532 123 45 67 - açıklama" satırları, gün başlıkları ("Pazartesi", "13.11.2026") · Excel: Tarih, Doktor, Telefon, Açıklama sütunları</span>
            </button>
            <Button
              variant="link"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                downloadExcelTemplate('temsilci-raporu-sablon', TEMPLATE_HEADERS, [
                  { Tarih: format(new Date(), 'dd.MM.yyyy'), Doktor: 'Dr. Ayşe Yılmaz', Telefon: '0532 123 45 67', Açıklama: 'Numune bırakıldı' },
                ])
              }
            >
              <FileSpreadsheet className="size-3.5" /> Örnek Excel şablonunu indir
            </Button>
          </div>
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
                    <TableHead className="w-40">Telefon</TableHead>
                    <TableHead className="w-[40%]">Açıklama</TableHead>
                    <TableHead className="w-40">Tarih</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const dup = isDuplicate(r)
                    return (
                      <TableRow key={r.key} className={dup ? 'opacity-60' : undefined}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Input value={r.doctor_name} onChange={(e) => update(r.key, { doctor_name: e.target.value })} placeholder="Doktor adı gerekli" aria-invalid={!r.doctor_name.trim()} />
                          {dup && (
                            <Badge variant="secondary" className="mt-1">
                              O gün zaten listede — eklenmeyecek
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input value={r.phone} onChange={(e) => update(r.key, { phone: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Textarea rows={3} className="min-h-0 text-sm" value={r.notes} onChange={(e) => update(r.key, { notes: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input type="date" value={r.visit_date} onChange={(e) => e.target.value && update(r.key, { visit_date: e.target.value })} />
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
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
