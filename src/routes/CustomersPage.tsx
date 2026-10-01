import * as React from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Search, Phone, Tag, ReceiptText, MapPin, Building2, User, CalendarClock, FileSpreadsheet, Trash2, Loader2, Star, Pencil } from 'lucide-react'
import { getPaymentDueStatus } from '@/lib/paymentDue'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { useCustomers, useDeleteCustomer, useUpdateCustomerFields } from '@/features/customers/hooks'
import type { CustomerInput } from '@/features/customers/api'
import { type InvoiceFilter } from '@/features/customers/api'
import { useRegions } from '@/features/regions/hooks'
import {
  importCustomerRows,
  CUSTOMER_IMPORT_HEADERS,
  CUSTOMER_IMPORT_SAMPLE_ROWS,
  CUSTOMER_IMPORT_FIELD_HINTS,
} from '@/features/customers/importCustomers'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay, normalizeTrPhone } from '@/features/whatsapp/normalizePhone'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { VcfImportDialog } from '@/features/customers/VcfImportDialog'
import { LocationFillDialog } from '@/features/customers/LocationFillDialog'
import { InlineTextCell } from '@/features/customers/InlineCells'
import { detectLocation, trFold, type DetectedLocation } from '@/lib/detectProvince'
import { ensureRegionFor } from '@/features/regions/ensureRegion'
import { cn } from '@/lib/utils'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import type { ImportSummary } from '@/lib/importData'
import { turkeyProvinces } from '@/lib/turkeyProvinces'
import type { Customer } from '@/types/database'

const ALL_PROVINCES = '__all__'
const ALL_TAGS = '__all_tags__'

type SortOption = 'name_asc' | 'name_desc' | 'province_asc'

const SORT_LABELS: Record<SortOption, string> = {
  name_asc: 'Ada Göre (A-Z)',
  name_desc: 'Ada Göre (Z-A)',
  province_asc: 'İl / İlçeye Göre (A-Z)',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * "İstanbul / Kadıköy", "izmir bornova", "Kadıköy" gibi serbest girişi il +
 * ilçeye çevirir. Boş → null (temizle). İl bulunamazsa 'invalid'.
 */
function parseLocationInput(text: string): DetectedLocation | null | 'invalid' {
  const raw = text.trim()
  if (!raw) return null
  const [first, ...rest] = raw.split(/[/,]/).map((x) => x.trim()).filter(Boolean)
  const province = turkeyProvinces.find((p) => trFold(p) === trFold(first))
  if (province) {
    const districtText = rest.join(' ').trim()
    if (districtText) {
      const known = detectLocation({ name: districtText })
      const district = known && known.province === province && known.district ? known.district : districtText
      return { province, district: district.charAt(0).toLocaleUpperCase('tr-TR') + district.slice(1) }
    }
    return { province, district: null }
  }
  // "izmir bornova" (ayraçsız) ya da sadece "Kadıköy" — algılayıcıya bırak
  const detected = detectLocation({ name: raw })
  if (!detected) return 'invalid'
  if (!detected.district) {
    const words = raw.split(/\s+/)
    const tail = words.filter((w) => trFold(w) !== trFold(detected.province)).join(' ').trim()
    if (tail) return { province: detected.province, district: tail.charAt(0).toLocaleUpperCase('tr-TR') + tail.slice(1) }
  }
  return detected
}

/** Mükerrer isim karşılaştırması için: unvanlar, noktalama ve Türkçe karakter/harf farkı yok sayılır. */
function nameKey(name: string): string {
  return trFold(name)
    .replace(/\b(dr|doc|prof|uzm|op|dt|ecz|hoca|hanim|hnm|bey)\b\.?/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return normalizeTrPhone(digits.startsWith('00') ? digits.slice(2) : phone)?.canonical ?? null
}

export function CustomersPage() {
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [invoiceFilter, setInvoiceFilter] = React.useState<InvoiceFilter>('all')
  const [provinceFilter, setProvinceFilter] = React.useState(ALL_PROVINCES)
  const [tagFilter, setTagFilter] = React.useState(ALL_TAGS)
  const [sortBy, setSortBy] = React.useState<SortOption>('name_asc')
  const { data: allCustomers = [], isLoading } = useCustomers(
    search,
    invoiceFilter,
    provinceFilter === ALL_PROVINCES ? undefined : provinceFilter,
  )
  const { data: regions = [] } = useRegions()
  const availableTags = React.useMemo(
    () => Array.from(new Set(allCustomers.flatMap((c) => c.tags))).sort((a, b) => a.localeCompare(b, 'tr')),
    [allCustomers],
  )
  const customers = React.useMemo(() => {
    let result = tagFilter === ALL_TAGS ? allCustomers : allCustomers.filter((c) => c.tags.includes(tagFilter))

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name, 'tr')
        case 'province_asc':
          return (
            (a.province ?? '').localeCompare(b.province ?? '', 'tr') ||
            (a.district ?? '').localeCompare(b.district ?? '', 'tr') ||
            a.full_name.localeCompare(b.full_name, 'tr')
          )
        case 'name_asc':
        default:
          return a.full_name.localeCompare(b.full_name, 'tr')
      }
    })
    return result
  }, [allCustomers, tagFilter, sortBy])
  const deleteMutation = useDeleteCustomer()
  const queryClient = useQueryClient()
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null)

  async function confirmDelete() {
    if (!customerToDelete) return
    await deleteMutation.mutateAsync(customerToDelete.id)
    setCustomerToDelete(null)
  }

  // Mükerrer kontrolü için ekrandaki arama/filtreden bağımsız TÜM cariler
  // (düzeltme, 2026-10-01 — filtre açıkken içe aktarınca filtre dışındaki
  // kayıtlı doktorlar "yeni" sanılıp tekrar ekleniyordu).
  const { data: everyCustomer = [] } = useCustomers('')
  const updateFields = useUpdateCustomerFields()
  function saveField(id: string, patch: Partial<CustomerInput>) {
    updateFields.mutate({ id, patch })
  }
  async function saveLocation(id: string, text: string) {
    const parsed = parseLocationInput(text)
    if (parsed === 'invalid') {
      toast.error('İl tanınamadı', { description: 'Örn. "İstanbul / Kadıköy", "İzmir Bornova" ya da sadece "Ankara" yazın.' })
      return
    }
    let regionId: string | null = null
    if (parsed) {
      try {
        regionId = await ensureRegionFor(parsed, [...regions])
      } catch {
        regionId = null
      }
    }
    updateFields.mutate(
      { id, patch: { province: parsed?.province ?? null, district: parsed?.district ?? null, region_id: regionId } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['regions'] }) },
    )
  }

  // Mükerrer kayıtlar (kullanıcı isteği, 2026-10-01: "aynı isimde ya da
  // numarada olanları ayır, kırmızıyla işaretle") — arama/filtreden bağımsız
  // TÜM carilerde aynı isim (Dr./Uzm. gibi unvanlar ve harf/Türkçe karakter
  // farkı yok sayılarak) ya da aynı numara (telefon/cep/WhatsApp) varsa.
  const duplicateKeys = React.useMemo(() => {
    const nameCount = new Map<string, number>()
    const phoneOwners = new Map<string, Set<string>>()
    for (const c of everyCustomer) {
      const nk = nameKey(c.full_name)
      if (nk) nameCount.set(nk, (nameCount.get(nk) ?? 0) + 1)
      for (const p of new Set([c.phone, c.mobile_phone, c.whatsapp_phone].map(phoneKey).filter(Boolean) as string[])) {
        if (!phoneOwners.has(p)) phoneOwners.set(p, new Set())
        phoneOwners.get(p)!.add(c.id)
      }
    }
    return { nameCount, phoneOwners }
  }, [everyCustomer])
  function duplicateInfo(c: Customer) {
    const nk = nameKey(c.full_name)
    const name = !!nk && (duplicateKeys.nameCount.get(nk) ?? 0) > 1
    const phone = [c.phone, c.mobile_phone, c.whatsapp_phone]
      .map(phoneKey)
      .some((p) => !!p && (duplicateKeys.phoneOwners.get(p)?.size ?? 0) > 1)
    return { name, phone }
  }
  const duplicateCount = React.useMemo(
    () => everyCustomer.filter((c) => { const d = duplicateInfo(c); return d.name || d.phone }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [everyCustomer, duplicateKeys],
  )
  const [onlyDuplicates, setOnlyDuplicates] = React.useState(false)
  // "Mükerrerler" açıkken sadece mükerrer kayıtlar, aynı isim/numara yan yana gelecek şekilde
  const shownCustomers = React.useMemo(() => {
    if (!onlyDuplicates) return customers
    return customers
      .filter((c) => { const d = duplicateInfo(c); return d.name || d.phone })
      .sort((a, b) => (phoneKey(a.phone) ?? '').localeCompare(phoneKey(b.phone) ?? '') || nameKey(a.full_name).localeCompare(nameKey(b.full_name), 'tr'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, onlyDuplicates, duplicateKeys])
  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const summary = await importCustomerRows(rows, everyCustomer)
    if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['customers'] })
    return summary
  }

  return (
    <div>
      <PageHeader
        title="Cari Kart"
        description="Doktor profillerini görüntüleyin, ekleyin ve WhatsApp'tan iletişime geçin — bakiye bilgileri Cari Hesap'ta"
        actions={
          <div className="flex gap-2">
            <ExportMenu<Customer>
              title="Cari Listesi"
              filename="musteriler"
              rows={customers}
              columns={[
                { header: 'Ad Soyad', value: (c) => c.full_name },
                { header: 'Telefon', value: (c) => formatTrPhoneForDisplay(c.phone) },
                { header: 'Tip', value: (c) => (c.doctor_type === 'hastane' ? 'Hastane' : 'Şahıs') },
                { header: 'İl', value: (c) => c.province ?? '' },
                { header: 'İlçe', value: (c) => c.district ?? '' },
                { header: 'Hastane', value: (c) => c.hospital_name ?? '' },
                { header: 'Ödeme Vadesi', value: (c) => c.next_payment_due ?? '' },
                { header: 'TC Kimlik No', value: (c) => c.tc_no ?? '' },
                { header: 'Vergi Numarası', value: (c) => c.tax_number ?? '' },
                { header: 'KDV Oranı', value: (c) => (c.vat_rate != null ? Number(c.vat_rate) : '') },
                { header: 'Adres', value: (c) => c.address ?? '' },
                { header: 'Fatura Durumu', value: (c) => (c.is_invoiced ? 'Faturalı' : 'Faturasız') },
                { header: 'Etiketler', value: (c) => c.tags.join(', ') },
              ]}
            />
            <ImportMenu
              onImport={handleImport}
              templateFilename="cari-kart-sablon"
              templateHeaders={CUSTOMER_IMPORT_HEADERS}
              templateSampleRows={CUSTOMER_IMPORT_SAMPLE_ROWS}
            />
            <VcfImportDialog />
            <LocationFillDialog />
            <SmartImportDialog
              title="Doktorları Akıllı İçe Aktar"
              targetLabel="doktor/cari kart"
              fieldHeaders={CUSTOMER_IMPORT_HEADERS}
              fieldHints={CUSTOMER_IMPORT_FIELD_HINTS}
              onImport={handleImport}
            />
            <CustomerForm />
          </div>
        }
      />

      <Tabs value={invoiceFilter} onValueChange={(v) => setInvoiceFilter(v as InvoiceFilter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="invoiced">Faturalı</TabsTrigger>
          <TabsTrigger value="not_invoiced">Faturasız</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="İsim veya telefon ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={provinceFilter} onValueChange={setProvinceFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="İl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROVINCES}>Tüm İller</SelectItem>
            {turkeyProvinces.map((il) => (
              <SelectItem key={il} value={il}>
                {il}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availableTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Etiket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS}>Tüm Etiketler</SelectItem>
              {availableTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type="button"
          variant={onlyDuplicates ? 'destructive' : 'outline'}
          onClick={() => setOnlyDuplicates((v) => !v)}
          disabled={duplicateCount === 0 && !onlyDuplicates}
          title="Aynı isimde ya da aynı numarada birden fazla kaydı olan kişiler"
        >
          Mükerrerler ({duplicateCount})
        </Button>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sırala" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>İl / İlçe</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Sosyal Medya</TableHead>
                <TableHead>Ödeme Vadesi</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead>Etiketler</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && shownCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Doktor bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {shownCustomers.map((customer) => {
                const dup = duplicateInfo(customer)
                return (
                <TableRow
                  key={customer.id}
                  onClick={() => setSelectedId(customer.id)}
                  selected={customer.id === selectedId}
                  className={cn((dup.name || dup.phone) && customer.id !== selectedId && 'bg-destructive/5')}
                >
                  <TableCell className="font-medium">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        to={`/musteriler/${customer.id}`}
                        title="Doktor detayını aç"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-full hover:ring-2 hover:ring-primary/40"
                      >
                        <Avatar className="size-6">
                          {customer.photo_url && <AvatarImage src={customer.photo_url} alt={customer.full_name} />}
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {getInitials(customer.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      {customer.is_vip && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
                      <InlineTextCell
                        value={customer.full_name}
                        placeholder="Ad Soyad"
                        className={cn(dup.name && 'font-semibold text-destructive')}
                        onSave={(v) => v && saveField(customer.id, { full_name: v })}
                      />
                      {dup.name && (
                        <Badge variant="destructive" className="shrink-0" title="Cari Kart'ta aynı isimde başka kayıt var">
                          Aynı isim
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className={cn('size-3.5 shrink-0', dup.phone && 'text-destructive')} />
                      <InlineTextCell
                        value={customer.phone}
                        display={formatTrPhoneForDisplay(customer.phone)}
                        placeholder="Telefon"
                        inputType="tel"
                        className={cn('whitespace-nowrap', dup.phone && 'font-semibold text-destructive')}
                        onSave={(v) => v && saveField(customer.id, { phone: v })}
                      />
                      {dup.phone && (
                        <Badge variant="destructive" className="shrink-0" title="Cari Kart'ta aynı numarada başka kayıt var">
                          Aynı numara
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    {customer.doctor_type === 'hastane' ? (
                      <Badge variant="outline">
                        <Building2 className="size-3" /> {customer.hospital_name || 'Hastane'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <User className="size-3" /> Şahıs
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground min-w-40">
                    {/* İl ve ilçe birlikte, tıklayınca düzenlenir (kullanıcı isteği,
                        2026-10-01: "il/ilçe şeklinde olsun, ayrı bölge yazmasın") —
                        "İstanbul / Kadıköy", "izmir bornova" ya da sadece "Kadıköy"
                        yazılabilir; bölge kaydı arka planda il/ilçeye eşlenir. */}
                    <InlineTextCell
                      value={customer.province ? (customer.district ? `${customer.province} / ${customer.district}` : customer.province) : ''}
                      display={
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          {customer.district ? `${customer.province} / ${customer.district}` : customer.province}
                        </span>
                      }
                      placeholder="İl / İlçe ekle"
                      onSave={(v) => void saveLocation(customer.id, v)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-52">
                    <InlineTextCell
                      value={customer.email ?? ''}
                      placeholder="E-posta ekle"
                      inputType="email"
                      className="truncate"
                      onSave={(v) => saveField(customer.id, { email: v || null })}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-44">
                    <InlineTextCell
                      value={customer.instagram ?? ''}
                      display={customer.instagram ? `@${customer.instagram.replace(/^@/, '')}` : undefined}
                      placeholder="Instagram ekle"
                      className="truncate"
                      onSave={(v) => saveField(customer.id, { instagram: v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '') || null })}
                    />
                  </TableCell>
                  <TableCell>
                    {customer.next_payment_due ? (
                      (() => {
                        const status = getPaymentDueStatus(customer.next_payment_due)
                        const label = format(new Date(customer.next_payment_due), 'd MMM yyyy', { locale: trLocale })
                        return (
                          <Badge variant={status === 'overdue' ? 'destructive' : status === 'upcoming' ? 'warning' : 'outline'}>
                            <CalendarClock className="size-3" /> {label}
                          </Badge>
                        )
                      })()
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.is_invoiced ? (
                      <Badge variant="success">
                        <ReceiptText className="size-3" /> Faturalı
                      </Badge>
                    ) : (
                      <Badge variant="outline">Faturasız</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {customer.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            <Tag className="size-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/cari-hesap/${customer.id}`}>
                          <FileSpreadsheet className="size-3.5" /> Cari Hesap
                        </Link>
                      </Button>
                      <WhatsAppSendDialog
                        customerName={customer.full_name}
                        customerPhone={customer.phone}
                      />
                      <CustomerForm
                        customer={customer}
                        trigger={
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCustomerToDelete(customer)
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Kişi sayısı (kullanıcı isteği, 2026-10-01) — toplam, arama/filtreden
          bağımsız tüm cari sayısı; filtre varsa listede kaçının göründüğü de. */}
      {!isLoading && (
        <p className="text-muted-foreground mt-3 text-right text-sm">
          Cari Kart'ta toplam <span className="text-foreground font-semibold">{everyCustomer.length}</span> kişi
          {customers.length !== everyCustomer.length && (
            <>
              {' '}
              · listede <span className="text-foreground font-semibold">{customers.length}</span> kişi gösteriliyor
            </>
          )}
        </p>
      )}

      <Dialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{customerToDelete?.full_name} silinsin mi?</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz. Doktora ait cari kart kaydı tamamen silinir.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerToDelete(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
