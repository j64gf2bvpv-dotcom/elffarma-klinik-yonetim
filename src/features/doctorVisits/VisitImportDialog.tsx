import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadExcelTemplate, readExcelFile } from '@/lib/importData'
import { getErrorMessage } from '@/lib/utils'
import { parseDoctorWord } from '@/features/customers/parseDoctorWord'
import type { Customer, DoctorVisit, SalesRep } from '@/types/database'
import { createVisit } from './api'

interface ImportRow {
  key: number
  doctor_name: string
  phone: string
  notes: string
  sales_rep_id: string
  visit_date: string
}

const TEMPLATE_HEADERS = ['Tarih', 'Temsilci', 'Doktor', 'Telefon', 'Açıklama']
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
 * Haftalık Satış Temsilcisi Raporu'na içe aktarma (kullanıcı isteği, 2026-11-13). Word (.docx) ya da
 * Excel dosyasındaki doktorlar (ad, telefon, açıklama) önizlemede tek tek gösterilir; her satırın
 * temsilcisi ve günü seçilebilir (Excel'de Tarih/Temsilci sütunu varsa oradan gelir). Onaylanınca
 * ziyaret olarak eklenir; Cari Kart'taki doktorla birebir aynı isim karta bağlanır.
 */
export function VisitImportDialog({
  reps,
  days,
  visits,
  customers,
}: {
  reps: SalesRep[]
  days: Date[]
  visits: DoctorVisit[]
  customers: Customer[]
}) {
  const [open, setOpen] = React.useState(false)
  const [repId, setRepId] = React.useState('')
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
      setRepId((r) => (reps.some((x) => x.id === r) ? r : (reps[0]?.id ?? '')))
      setDate(dayKeys.includes(today) ? today : dayKeys[0])
      setFileName(null)
      setRows([])
    }
    setOpen(next)
  }

  function findRep(name: unknown): string | null {
    const key = fold(String(name ?? ''))
    if (!key) return null
    return reps.find((r) => fold(r.name) === key)?.id ?? reps.find((r) => fold(r.name).startsWith(key) || key.startsWith(fold(r.name)))?.id ?? null
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
          sales_rep_id: repId,
          visit_date: date,
        }))
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        parsed = (await readExcelFile(file))
          .map((row) => ({
            doctor_name: String(pick(row, 'Doktor', 'Doktor Adı', 'Ad Soyad', 'Adı Soyadı', 'İsim', 'Ad') ?? '').trim(),
            phone: String(pick(row, 'Telefon', 'Tel', 'GSM', 'Cep', 'Cep Telefonu') ?? '').trim(),
            notes: String(pick(row, 'Açıklama', 'Not', 'Notlar', 'Aciklama') ?? '').trim(),
            sales_rep_id: findRep(pick(row, 'Temsilci', 'Satış Temsilcisi', 'Personel')) ?? repId,
            visit_date: toDateKey(pick(row, 'Tarih', 'Ziyaret Tarihi', 'Gün')) ?? date,
          }))
          .filter((r) => r.doctor_name || r.phone)
      } else {
        throw new Error('Word (.docx) ya da Excel (.xlsx) dosyası seçin.')
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
    visits.some((v) => v.sales_rep_id === r.sales_rep_id && v.visit_date === r.visit_date && fold(v.doctor_name) === fold(r.doctor_name))
  const ready = rows.filter((r) => r.doctor_name.trim() && r.sales_rep_id && r.visit_date && !isDuplicate(r))

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
            sales_rep_id: r.sales_rep_id,
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
      if (added) toast.success(`${added} doktor rapora eklendi`)
      if (errors.length) toast.error(`${errors.length} doktor eklenemedi`, { description: errors.slice(0, 3).join(' • ') })
      if (!errors.length) setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const dateOptions = Array.from(new Set([...dayKeys, ...rows.map((r) => r.visit_date)])).sort()
  const dateLabel = (k: string) => format(new Date(`${k}T00:00:00`), 'EEE d MMM', { locale: trLocale })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="outline" onClick={() => handleOpenChange(true)} disabled={!reps.length}>
        <Upload className="size-4" /> İçe Aktar
      </Button>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Rapora Doktor İçe Aktar</DialogTitle>
          <DialogDescription>
            Word ya da Excel dosyasındaki doktorların adı, telefonu ve açıklaması tek tek okunur. Temsilciyi ve günü seçin, kontrol edip kaydedin.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ''))}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Temsilci</Label>
            <Select
              value={repId}
              onValueChange={(v) => {
                setRepId(v)
                applyToAll({ sales_rep_id: v })
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Gün</Label>
            <Select
              value={date}
              onValueChange={(v) => {
                setDate(v)
                applyToAll({ visit_date: v })
              }}
            >
              <SelectTrigger className="w-40 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dayKeys.map((k) => (
                  <SelectItem key={k} value={k} className="capitalize">
                    {dateLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="pb-2 text-xs text-muted-foreground">Değiştirince listedeki bütün doktorlara uygulanır; tek tek satırdan da değiştirebilirsiniz.</p>
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
              Word ya da Excel dosyasını seçmek için tıklayın veya buraya sürükleyin
              <span className="text-xs">Word: tablo ya da "Dr. Ad Soyad - 0532 123 45 67 - açıklama" satırları · Excel: Tarih, Temsilci, Doktor, Telefon, Açıklama sütunları</span>
            </button>
            <Button
              variant="link"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                downloadExcelTemplate('temsilci-raporu-sablon', TEMPLATE_HEADERS, [
                  { Tarih: format(new Date(), 'dd.MM.yyyy'), Temsilci: reps[0]?.name ?? '', Doktor: 'Dr. Ayşe Yılmaz', Telefon: '0532 123 45 67', Açıklama: 'Numune bırakıldı' },
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
                    <TableHead>Açıklama</TableHead>
                    <TableHead className="w-36">Temsilci</TableHead>
                    <TableHead className="w-36">Gün</TableHead>
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
                          <Input value={r.notes} onChange={(e) => update(r.key, { notes: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Select value={r.sales_rep_id} onValueChange={(v) => update(r.key, { sales_rep_id: v })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {reps.map((x) => (
                                <SelectItem key={x.id} value={x.id}>
                                  {x.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={r.visit_date} onValueChange={(v) => update(r.key, { visit_date: v })}>
                            <SelectTrigger className="capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dateOptions.map((k) => (
                                <SelectItem key={k} value={k} className="capitalize">
                                  {dateLabel(k)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
