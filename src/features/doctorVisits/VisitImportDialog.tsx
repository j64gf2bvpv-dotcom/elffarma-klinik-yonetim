import * as React from 'react'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Loader2, MessageCircle, Trash2, Upload } from 'lucide-react'
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
import { parseWhatsAppChat, readWhatsAppChatFile } from './whatsappChat'
import type { Customer, DoctorVisit, SalesRep } from '@/types/database'
import { createVisit, fetchRepVisitDoctors, fetchVisitsInRange, setVisitSale } from './api'
import { formatSale, parseChatSales, type VisitSale } from './chatSales'
import { nameKey, phoneKey } from '@/features/customers/dedupe'
import { updateCustomerFields } from '@/features/customers/api'

interface ImportRow {
  key: number
  doctor_name: string
  phone: string
  notes: string
  visit_date: string
  /** Kullanıcının elle seçimi; yoksa "programda yoksa ekle" kuralı geçerli */
  include?: boolean
  /** WhatsApp sohbetinden okunan satış (ürün, tutar) */
  sale?: VisitSale | null
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

/**
 * Başlık tam tutmazsa içinde geçen kelimeyle bulur ("Doktor Adı Soyadı", "Hekim", "Cep Tel No" gibi —
 * kullanıcı isteği, 2026-11-19: hazır doktor listesi Excel'i olduğu gibi okunsun)
 */
function pickLoose(row: Record<string, unknown>, test: (key: string) => boolean): unknown {
  for (const [k, v] of Object.entries(row)) {
    if (test(fold(k)) && v != null && String(v).trim() !== '') return v
  }
  return undefined
}
const isNameHeader = (k: string) => /doktor|hekim|dr\b|isim|ad[ıi]? ?soyad|^ad[ıi]?$|ünvan/.test(k) && !/tel|gsm|cep|numara|tarih|açıklama|not/.test(k)
const isPhoneHeader = (k: string) => /tel|gsm|cep|numara|phone/.test(k)

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
  const chatRef = React.useRef<HTMLInputElement>(null)
  // İçe aktarılan tarihlerdeki mevcut kayıtlar (başka haftalar dahil) — mükerrer eklenmesin
  const [existing, setExisting] = React.useState<DoctorVisit[]>([])
  // Temsilcinin bütün geçmiş ziyaretleri — doktor programda var mı kıyası
  const [repDoctors, setRepDoctors] = React.useState<Pick<DoctorVisit, 'doctor_name' | 'phone' | 'visit_date'>[]>([])
  const today = format(new Date(), 'yyyy-MM-dd')
  const queryClient = useQueryClient()

  const dayKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  function handleOpenChange(next: boolean) {
    if (next) {
      const today = format(new Date(), 'yyyy-MM-dd')
      setDate(dayKeys.includes(today) ? today : dayKeys[0])
      setFileName(null)
      setRows([])
      setExisting([])
    }
    setOpen(next)
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      let parsed: Omit<ImportRow, 'key'>[]
      if (/\.(txt|zip)$/i.test(file.name)) {
        // WhatsApp "Sohbeti Dışa Aktar": her mesaj kendi tarihine, sadece doktor kayıtları
        const chatText = await readWhatsAppChatFile(file)
        const visitRows: Omit<ImportRow, 'key'>[] = parseWhatsAppChat(chatText, rep.name).map((r) => ({
          doctor_name: r.name,
          phone: r.phone,
          notes: r.notes,
          visit_date: r.date ?? date,
        }))
        // Satışlar (yalnız fiyatı yazılmış ürünler) aynı gün aynı doktorun kaydına eklenir; doktor o gün yoksa yeni kayıt
        for (const s of parseChatSales(chatText, rep.name)) {
          const same = s.name ? visitRows.find((v) => v.visit_date === s.date && nameKey(v.doctor_name) === nameKey(s.name)) : undefined
          if (same) {
            same.sale = same.sale
              ? { items: [...same.sale.items, ...s.sale.items], total: same.sale.total != null || s.sale.total != null ? (same.sale.total ?? 0) + (s.sale.total ?? 0) : null }
              : s.sale
            if (!same.phone) same.phone = s.phone
          } else visitRows.push({ doctor_name: s.name, phone: s.phone, notes: '', visit_date: s.date, sale: s.sale })
        }
        parsed = visitRows
      } else if (/\.docx$/i.test(file.name)) {
        parsed = (await parseDoctorWord(file)).map((r) => ({
          doctor_name: r.name,
          phone: r.phone,
          notes: r.notes,
          visit_date: date,
        }))
      } else if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        parsed = (await readExcelFile(file))
          .map((row) => ({
            doctor_name: String(pick(row, 'Doktor', 'Doktor Adı', 'Ad Soyad', 'Adı Soyadı', 'İsim', 'Ad') ?? pickLoose(row, isNameHeader) ?? '').trim(),
            phone: String(pick(row, 'Telefon', 'Tel', 'GSM', 'Cep', 'Cep Telefonu') ?? pickLoose(row, isPhoneHeader) ?? '').trim(),
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
        throw new Error('Word (.docx), Excel (.xlsx), resim ya da WhatsApp sohbeti (.txt/.zip) seçin.')
      }
      // Günü gelmemiş tarihler alınmaz (kullanıcı isteği, 2026-11-13)
      const future = parsed.filter((r) => r.visit_date > today).length
      parsed = parsed.filter((r) => r.visit_date <= today)
      if (future) toast.info(`İleri tarihli ${future} kayıt alınmadı`)
      if (!parsed.length) {
        toast.error('Dosyada doktor bulunamadı')
        return
      }
      const dates = parsed.map((r) => r.visit_date).sort()
      setExisting(await fetchVisitsInRange(dates[0], dates[dates.length - 1], rep.id).catch(() => []))
      setRepDoctors(await fetchRepVisitDoctors(rep.id).catch(() => []))
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
    [...visits, ...existing].some((v) => v.sales_rep_id === rep.id && v.visit_date === r.visit_date && fold(v.doctor_name) === fold(r.doctor_name))
  /**
   * Doktor programda var mı (kullanıcı isteği, 2026-11-19: "her doktoru ayrı, numarası varsa isim isim
   * numaraları ile programdakini kıyaslasın, aynıysa eklemesin yeniyse eklesin"): aynı isim (ünvan/harf farkı
   * gözetmeden) ya da aynı telefon + aynı soyadı (ortak klinik hattı başka doktorla karışmasın).
   */
  const sameDoctor = (r: ImportRow) => {
    const nk = nameKey(r.doctor_name)
    const pk = phoneKey(r.phone)
    const last = (k: string) => k.split(' ').pop() ?? ''
    return (name: string, ...phones: (string | null | undefined)[]) => {
      const k = nameKey(name)
      if (!nk || !k) return false
      return k === nk || (!!pk && last(k) === last(nk) && phones.some((p) => phoneKey(p) === pk))
    }
  }
  const matchedCustomer = (r: ImportRow) => {
    const same = sameDoctor(r)
    return customers.find((c) => same(c.full_name, c.phone, c.mobile_phone, c.whatsapp_phone))
  }
  const knownReason = (r: ImportRow): string | null => {
    const same = sameDoctor(r)
    const v = repDoctors.find((d) => same(d.doctor_name, d.phone))
    if (v) return `${rep.name} listesinde var (${v.visit_date.split('-').reverse().join('.')})`
    if (matchedCustomer(r)) return "Cari Kart'ta var"
    return null
  }
  const willAdd = (r: ImportRow) => r.include ?? (!!r.sale || !knownReason(r))
  const ready = rows.filter((r) => r.doctor_name.trim() && r.visit_date && r.visit_date <= today && !isDuplicate(r) && willAdd(r))
  // O gün zaten listede olan doktorun satışı: mevcut kayda yazılır (satışı yoksa ya da farklıysa)
  const existingVisitOf = (r: ImportRow) =>
    [...visits, ...existing].find((v) => v.sales_rep_id === rep.id && v.visit_date === r.visit_date && fold(v.doctor_name) === fold(r.doctor_name))
  const saleUpdates = rows.filter((r) => {
    if (!r.sale || !isDuplicate(r)) return false
    const v = existingVisitOf(r)
    return !!v && JSON.stringify(v.sale ?? null) !== JSON.stringify(r.sale)
  })
  const knownCount = rows.filter((r) => !isDuplicate(r) && knownReason(r)).length

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
            sale: r.sale ?? null,
          })
          added++
        } catch (err) {
          errors.push(`${name}: ${getErrorMessage(err)}`)
        }
      }
      let salesSet = 0
      for (const r of saleUpdates) {
        const v = existingVisitOf(r)
        if (!v) continue
        try {
          await setVisitSale(v.id, r.sale ?? null)
          salesSet++
        } catch (err) {
          errors.push(`${r.doctor_name}: ${getErrorMessage(err)}`)
        }
      }
      if (salesSet) toast.success(`${salesSet} doktorun satışı mevcut kaydına işlendi`)
      // Eklenmeyen (programda var) doktorların Cari Kart'ta eksik telefonu listeden tamamlanır
      let phonesFilled = 0
      for (const r of rows) {
        if (ready.includes(r) || !phoneKey(r.phone)) continue
        const c = matchedCustomer(r)
        if (c && !c.phone?.trim() && !c.mobile_phone?.trim()) {
          try {
            await updateCustomerFields(c.id, { phone: r.phone.trim() })
            phonesFilled++
          } catch (err) {
            errors.push(`${c.full_name}: ${getErrorMessage(err)}`)
          }
        }
      }
      if (phonesFilled) toast.success(`${phonesFilled} doktorun Cari Kart'taki eksik telefonu tamamlandı`)
      await queryClient.invalidateQueries({ queryKey: ['doctor_visits'] })
      void queryClient.invalidateQueries({ queryKey: ['doctor_visit_dates'] })
      void queryClient.invalidateQueries({ queryKey: ['doctor_visit_totals'] })
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
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
            Word, Excel, resim ya da WhatsApp sohbetindeki doktorların adı, telefonu ve açıklaması tek tek okunur ve {rep.name} listesine eklenir. Cari Kart'ta olmayan doktorlar oraya da eklenir, kartında telefonu eksik olanların numarası tamamlanır. Resimde gün yazıyorsa gün de oradan alınır; kontrol edip kaydedin.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept={`.docx,.xlsx,.xls,.csv,${IMAGE_ACCEPT}`}
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ''))}
        />
        <input
          ref={chatRef}
          type="file"
          accept=".txt,.zip"
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0]).finally(() => (e.target.value = ''))}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Tarih</Label>
            <Input
              type="date"
              className="w-44"
              max={today}
              value={date}
              onChange={(e) => {
                if (!e.target.value || e.target.value > today) return
                setDate(e.target.value)
                applyToAll({ visit_date: e.target.value })
              }}
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">Eski bir tarih de seçebilirsiniz (günü gelmemiş tarih seçilemez). Değiştirince bütün doktorlara uygulanır; her doktorun tarihini satırından da değiştirebilirsiniz.</p>
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
              <span className="text-xs">Word/resim: tablo ya da "Dr. Ad Soyad - 0532 123 45 67 - açıklama" satırları, gün başlıkları ("Pazartesi", "13.11.2026") · Excel: doktor adı ve telefon sütunları (başlık adı serbest), varsa Tarih ve Açıklama</span>
            </button>
            <Button variant="outline" disabled={busy} onClick={() => chatRef.current?.click()} className="justify-self-start">
              <MessageCircle className="size-4 text-success" /> WhatsApp Sohbetinden İçe Aktar (.txt / .zip)
            </Button>
            <p className="text-xs text-muted-foreground">
              WhatsApp'ta sohbeti açın → kişi/grup adına dokunun → "Sohbeti Dışa Aktar" → "Medya Olmadan". Gelen dosyayı buraya seçin; mesajlar tarih tarih okunur, yalnızca doktorların adı ve telefonu alınır.
            </p>
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
                <b>{fileName}</b> · {rows.length} doktor okundu · <b className="text-success">{ready.length} yeni</b> eklenecek
                {knownCount > 0 && <> · <b>{knownCount}</b> tanesi programda zaten var, eklenmeyecek</>}
                {rows.some((r) => r.sale) && <> · <b className="text-success">{rows.filter((r) => r.sale).length} satış</b> okundu</>}
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
                    <TableHead className="w-[30%]">Açıklama</TableHead>
                    <TableHead className="w-40">Tarih</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Hafta hafta, her hafta kendi başlığıyla (kullanıcı isteği, 2026-11-17: "listede haftalık görünsün tek tek") */}
                  {[...rows].sort((a, b) => a.visit_date.localeCompare(b.visit_date) || a.key - b.key).map((r, i, sorted) => {
                    const dup = isDuplicate(r)
                    const wk = (d: string) => format(startOfWeek(new Date(`${d}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd')
                    const newWeek = i === 0 || wk(sorted[i - 1].visit_date) !== wk(r.visit_date)
                    const ws = new Date(`${wk(r.visit_date)}T00:00:00`)
                    return (
                      <React.Fragment key={r.key}>
                      {newWeek && (
                        <TableRow className="bg-red-500/10 hover:bg-red-500/10">
                          <TableCell colSpan={6} className="py-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                            {format(ws, 'd MMM', { locale: trLocale })} – {format(endOfWeek(ws, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: trLocale })} haftası ·{' '}
                            {sorted.filter((x) => wk(x.visit_date) === wk(r.visit_date)).length} doktor
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className={(dup && !saleUpdates.includes(r)) || (!dup && !willAdd(r)) ? 'bg-muted/30 opacity-60' : undefined}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Input value={r.doctor_name} onChange={(e) => update(r.key, { doctor_name: e.target.value })} placeholder="Doktor adı gerekli" aria-invalid={!r.doctor_name.trim()} />
                          {dup && (
                            <Badge variant="secondary" className="mt-1">
                              O gün zaten listede — eklenmeyecek
                            </Badge>
                          )}
                          {r.sale && (
                            <p className="mt-1 rounded bg-success/10 px-1.5 py-1 text-xs text-success">
                              Satış: {formatSale(r.sale)}
                              {dup && saleUpdates.includes(r) && ' — mevcut kayda işlenecek'}
                            </p>
                          )}
                          {!r.doctor_name.trim() && r.sale && <p className="mt-1 text-xs text-destructive">Sohbette doktor adı yok — adı yazın ya da satırı silin</p>}
                          {!dup && (() => {
                            const reason = knownReason(r)
                            if (!reason) return <Badge className="mt-1 bg-success/15 text-success hover:bg-success/15">Yeni — eklenecek</Badge>
                            return (
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge variant="secondary">{reason}{willAdd(r) ? '' : ' — eklenmeyecek'}</Badge>
                                <button type="button" className="text-primary text-xs underline-offset-2 hover:underline" onClick={() => update(r.key, { include: !willAdd(r) })}>
                                  {willAdd(r) ? 'Ekleme' : 'Yine de ekle'}
                                </button>
                              </div>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <Input type="tel" className="min-w-36 tabular-nums" value={r.phone} onChange={(e) => update(r.key, { phone: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Textarea rows={r.notes ? 3 : 1} className="min-h-9 text-sm" value={r.notes} onChange={(e) => update(r.key, { notes: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input type="date" max={today} value={r.visit_date} onChange={(e) => e.target.value && e.target.value <= today && update(r.key, { visit_date: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" title="Listeden çıkar" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      </React.Fragment>
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
          <Button onClick={() => void handleConfirm()} disabled={busy || (!ready.length && !saleUpdates.length)}>
            {busy && rows.length > 0 && <Loader2 className="animate-spin" />} {[ready.length && `${ready.length} Doktoru Ekle`, saleUpdates.length && `${saleUpdates.length} Satışı İşle`].filter(Boolean).join(' + ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
