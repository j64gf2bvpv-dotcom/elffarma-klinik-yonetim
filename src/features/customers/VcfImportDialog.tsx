import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Contact, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseVCards, rankPhones, type VCardContact } from '@/lib/vcard'
import { formatTrPhoneForDisplay, normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { getErrorMessage } from '@/lib/utils'
import { createCustomer } from './api'
import { detectLocation, type DetectedLocation } from '@/lib/detectProvince'
import { fetchRegions } from '@/features/regions/api'
import { ensureRegionFor } from '@/features/regions/ensureRegion'
import { useCustomers } from './hooks'
import type { Customer } from '@/types/database'

/**
 * Telefon rehberinden (.vcf — Samsung / Apple dışa aktarımı) Cari Kart'a
 * doktor aktarma (kullanıcı isteği, 2026-10-01). Rehberde doktor olmayan
 * kişiler de olacağı için kayıt öncesi ÖNİZLEME var: kişiler listelenir,
 * sistemde zaten kayıtlı numaralar (telefon / cep / WhatsApp alanlarından
 * biriyle eşleşen) işaretlenir ve seçilemez, kullanıcı aktarılacakları
 * tek tek ya da toplu seçer. Aktarılanlara sonradan bulunabilsinler diye
 * "rehber" etiketi eklenir.
 */

type RowStatus = 'new' | 'exists' | 'duplicate' | 'noPhone'

interface PreviewRow {
  key: string
  contact: VCardContact
  phoneRaw: string
  canonical: string | null
  isMobile: boolean
  otherPhones: string[]
  /** Kişi adı/kurum/adres/nottan algılanan il/ilçe (ör. "Özge Hoca İzmir" → İzmir) */
  location: DetectedLocation | null
  status: RowStatus
}

const STATUS_LABEL: Record<RowStatus, string> = {
  new: 'Yeni',
  exists: 'Zaten kayıtlı',
  duplicate: 'Dosyada tekrar',
  noPhone: 'Numara yok',
}

const DOCTOR_PATTERN = /(^|[\s.(])(dr|doç|doc|prof|uzm|op)\b\.?|doktor|hekim|klinik|hastane|estetik|dermatolog/i

/** "0090 532 ..." gibi uluslararası öneki "00" ile yazılmış numaraları da tanır. */
function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  return normalizeTrPhone(digits.startsWith('00') ? digits.slice(2) : raw)
}

function buildRows(contacts: VCardContact[], existing: Customer[]): PreviewRow[] {
  const known = new Set<string>()
  for (const c of existing) {
    for (const p of [c.phone, c.mobile_phone, c.whatsapp_phone]) {
      const n = p ? normalizePhone(p) : null
      if (n) known.add(n.canonical)
    }
  }
  const seenInFile = new Set<string>()
  return contacts.map((contact, i) => {
    const ranked = rankPhones(contact.phones)
    const best = ranked[0]
    const normalized = best ? normalizePhone(best.value) : null
    const canonical = normalized?.canonical ?? null
    let status: RowStatus = 'new'
    if (!best) status = 'noPhone'
    else if (canonical && known.has(canonical)) status = 'exists'
    else if (canonical && seenInFile.has(canonical)) status = 'duplicate'
    if (canonical) seenInFile.add(canonical)
    return {
      key: `${i}-${contact.fullName}`,
      contact,
      phoneRaw: best?.value ?? '',
      canonical,
      isMobile: normalized?.isMobile ?? false,
      // Aynı numaranın farklı yazılışları (+90…, 0…) notlara tekrar yazılmasın
      otherPhones: ranked.slice(1).reduce<{ list: string[]; seen: Set<string> }>(
        (acc, p) => {
          const key = normalizePhone(p.value)?.canonical ?? p.value.replace(/\D/g, '')
          if (key !== canonical && !acc.seen.has(key)) {
            acc.seen.add(key)
            acc.list.push(p.value)
          }
          return acc
        },
        { list: [], seen: new Set() },
      ).list,
      location: detectLocation({ name: contact.fullName, org: contact.org, address: contact.address, note: contact.note }),
      status,
    }
  })
}

export function VcfImportDialog() {
  // Mükerrer kontrolü sayfadaki arama/filtreden bağımsız TÜM carilerle yapılır.
  const { data: existingCustomers = [] } = useCustomers('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<PreviewRow[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState('')
  const [onlyDoctors, setOnlyDoctors] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [fileLabel, setFileLabel] = React.useState('')

  async function handleFiles(fileList: FileList | null) {
    // FileList canlı bir nesne — input.value sıfırlanınca boşalıyor; hemen kopyala.
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return
    try {
      const texts = await Promise.all(files.map((f) => f.text()))
      const contacts = texts.flatMap((t) => parseVCards(t)).filter((c) => c.fullName || c.phones.length > 0)
      if (contacts.length === 0) {
        toast.error('Dosyada kişi bulunamadı', { description: 'Lütfen telefon rehberinden dışa aktarılmış bir .vcf dosyası seçin.' })
        return
      }
      for (const c of contacts) if (!c.fullName) c.fullName = c.phones[0]?.value ?? 'İsimsiz'
      const built = buildRows(contacts, existingCustomers)
      setRows(built)
      setSelected(new Set())
      setSearch('')
      setOnlyDoctors(false)
      setFileLabel(files.length === 1 ? files[0].name : `${files.length} dosya`)
      setOpen(true)
    } catch (err) {
      toast.error('Dosya okunamadı', { description: getErrorMessage(err) })
    }
  }

  const visible = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return rows.filter((r) => {
      if (onlyDoctors && !DOCTOR_PATTERN.test(`${r.contact.fullName} ${r.contact.org} ${r.contact.title}`)) return false
      if (!q) return true
      return (
        r.contact.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
        r.contact.org.toLocaleLowerCase('tr-TR').includes(q) ||
        r.phoneRaw.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000')
      )
    })
  }, [rows, search, onlyDoctors])

  const withProvince = rows.filter((r) => r.location).length
  const selectableVisible = visible.filter((r) => r.status === 'new')
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.key))
  const counts = React.useMemo(() => {
    const c: Record<RowStatus, number> = { new: 0, exists: 0, duplicate: 0, noPhone: 0 }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) for (const r of selectableVisible) next.delete(r.key)
      else for (const r of selectableVisible) next.add(r.key)
      return next
    })
  }

  async function handleImport() {
    const toImport = rows.filter((r) => selected.has(r.key) && r.status === 'new')
    if (toImport.length === 0) return
    setImporting(true)
    setProgress(0)
    const succeeded = new Set<string>()
    const errors: string[] = []
    // Algılanan il/ilçe için bölge bulunur ya da oluşturulur (tek liste paylaşılır)
    const regions = await fetchRegions().catch(() => null)
    for (const r of toImport) {
      const c = r.contact
      const noteParts = [
        c.title && `Ünvan: ${c.title}`,
        r.otherPhones.length > 0 && `Diğer numaralar: ${r.otherPhones.join(', ')}`,
        c.emails.length > 1 && `Diğer e-postalar: ${c.emails.slice(1).join(', ')}`,
        c.note,
      ].filter(Boolean)
      try {
        const regionId = r.location && regions ? await ensureRegionFor(r.location, regions) : null
        await createCustomer({
          full_name: c.fullName,
          phone: r.canonical ?? r.phoneRaw,
          mobile_phone: r.canonical && r.isMobile ? r.canonical : null,
          email: c.emails[0] ?? null,
          hospital_name: c.org || null,
          province: r.location?.province ?? null,
          district: r.location?.district ?? null,
          region_id: regionId,
          address: c.address || null,
          notes: noteParts.length > 0 ? noteParts.join('\n') : null,
          doctor_type: 'sahis',
          is_invoiced: false,
          tags: ['rehber'],
        })
        succeeded.add(r.key)
      } catch (err) {
        errors.push(`${c.fullName}: ${getErrorMessage(err)}`)
      }
      setProgress((p) => p + 1)
    }
    setImporting(false)
    const added = succeeded.size
    if (added > 0) {
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      await queryClient.invalidateQueries({ queryKey: ['regions'] })
      toast.success(`${added} kişi Cari Kart'a eklendi`, { description: '"rehber" etiketiyle bulabilirsiniz.' })
    }
    if (errors.length > 0) {
      toast.error(`${errors.length} kişi eklenemedi`, { description: errors.slice(0, 3).join(' • ') })
      // Eklenenler listeden düşer; eklenemeyenler seçili kalır, tekrar denenebilir
      setRows((prev) => prev.filter((r) => !succeeded.has(r.key)))
      setSelected((prev) => new Set([...prev].filter((k) => !succeeded.has(k))))
    } else {
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Contact /> Rehberden Aktar
      </Button>

      <Dialog open={open} onOpenChange={(next) => !importing && setOpen(next)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rehberden Cari Kart'a Aktar</DialogTitle>
            <DialogDescription>
              {fileLabel} — {rows.length} kişi okundu: {counts.new} yeni, {counts.exists} zaten kayıtlı
              {counts.duplicate > 0 && `, ${counts.duplicate} dosyada tekrar`}
              {counts.noPhone > 0 && `, ${counts.noPhone} numarasız`}. {withProvince} kişide il/ilçe algılandı (İl, İlçe ve Bölge alanına yazılır).
              Aktarmak istediğiniz doktorları seçin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim, kurum veya numara ara..."
                className="pl-8"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={onlyDoctors} onCheckedChange={(v) => setOnlyDoctors(v === true)} />
              Sadece "Dr., Doç., Prof., Klinik…" içerenler
            </label>
          </div>

          <div className="flex items-center justify-between border-b pb-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                disabled={selectableVisible.length === 0}
              />
              Görünen yenilerin tümünü seç ({selectableVisible.length})
            </label>
            <span className="text-muted-foreground">{selected.size} kişi seçili</span>
          </div>

          <div className="max-h-[45vh] overflow-y-auto">
            {visible.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Eşleşen kişi yok.</p>}
            {visible.map((r) => {
              const disabled = r.status !== 'new'
              return (
                <label
                  key={r.key}
                  className={
                    'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm ' +
                    (disabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent')
                  }
                >
                  <Checkbox checked={selected.has(r.key)} onCheckedChange={() => toggle(r.key)} disabled={disabled} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.contact.fullName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {r.canonical ? formatTrPhoneForDisplay(r.canonical) : r.phoneRaw || '—'}
                      {r.otherPhones.length > 0 && ` · +${r.otherPhones.length} numara`}
                      {r.contact.org && ` · ${r.contact.org}`}
                    </p>
                  </div>
                  {r.location && (
                    <Badge variant="outline" title="Rehberdeki isim/kurum/adresten algılandı — İl ve Bölge alanına yazılacak">
                      {r.location.district ? `${r.location.province} / ${r.location.district}` : r.location.province}
                    </Badge>
                  )}
                  {r.status !== 'new' && <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>}
                </label>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
              Vazgeç
            </Button>
            <Button onClick={handleImport} disabled={importing || selected.size === 0}>
              {importing && <Loader2 className="animate-spin" />}
              {importing ? `Aktarılıyor ${progress}/${selected.size}` : `${selected.size} Kişiyi Aktar`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
