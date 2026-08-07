import * as React from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Search, Phone, Tag, ReceiptText, MapPin, Building2, User, CalendarClock, FileSpreadsheet, Trash2, Loader2, Star } from 'lucide-react'
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
import { useCustomers, useDeleteCustomer } from '@/features/customers/hooks'
import { type InvoiceFilter } from '@/features/customers/api'
import { useRegions } from '@/features/regions/hooks'
import { regionLabel } from '@/features/regions/RegionPicker'
import {
  importCustomerRows,
  CUSTOMER_IMPORT_HEADERS,
  CUSTOMER_IMPORT_SAMPLE_ROWS,
  CUSTOMER_IMPORT_FIELD_HINTS,
} from '@/features/customers/importCustomers'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { SmartImportDialog } from '@/features/smartImport/SmartImportDialog'
import type { ImportSummary } from '@/lib/importData'
import { turkeyProvinces } from '@/lib/turkeyProvinces'
import type { Customer } from '@/types/database'

const ALL_PROVINCES = '__all__'
const ALL_TAGS = '__all_tags__'
const ALL_REGIONS = '__all_regions__'

type SortOption = 'name_asc' | 'name_desc' | 'province_asc' | 'region_asc'

const SORT_LABELS: Record<SortOption, string> = {
  name_asc: 'Ada Göre (A-Z)',
  name_desc: 'Ada Göre (Z-A)',
  province_asc: 'Şehre Göre (A-Z)',
  region_asc: 'Bölgeye Göre (A-Z)',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function CustomersPage() {
  const [search, setSearch] = React.useState('')
  const [invoiceFilter, setInvoiceFilter] = React.useState<InvoiceFilter>('all')
  const [provinceFilter, setProvinceFilter] = React.useState(ALL_PROVINCES)
  const [tagFilter, setTagFilter] = React.useState(ALL_TAGS)
  const [regionFilter, setRegionFilter] = React.useState(ALL_REGIONS)
  const [sortBy, setSortBy] = React.useState<SortOption>('name_asc')
  const { data: allCustomers = [], isLoading } = useCustomers(
    search,
    invoiceFilter,
    provinceFilter === ALL_PROVINCES ? undefined : provinceFilter,
  )
  const { data: regions = [] } = useRegions()
  const regionById = React.useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])
  const availableTags = React.useMemo(
    () => Array.from(new Set(allCustomers.flatMap((c) => c.tags))).sort((a, b) => a.localeCompare(b, 'tr')),
    [allCustomers],
  )
  const customers = React.useMemo(() => {
    let result = tagFilter === ALL_TAGS ? allCustomers : allCustomers.filter((c) => c.tags.includes(tagFilter))
    if (regionFilter !== ALL_REGIONS) result = result.filter((c) => c.region_id === regionFilter)

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name, 'tr')
        case 'province_asc':
          return (a.province ?? '').localeCompare(b.province ?? '', 'tr') || a.full_name.localeCompare(b.full_name, 'tr')
        case 'region_asc': {
          const aRegion = a.region_id ? regionById.get(a.region_id) : undefined
          const bRegion = b.region_id ? regionById.get(b.region_id) : undefined
          const aLabel = aRegion ? regionLabel(aRegion, regionById) : ''
          const bLabel = bRegion ? regionLabel(bRegion, regionById) : ''
          return aLabel.localeCompare(bLabel, 'tr') || a.full_name.localeCompare(b.full_name, 'tr')
        }
        case 'name_asc':
        default:
          return a.full_name.localeCompare(b.full_name, 'tr')
      }
    })
    return result
  }, [allCustomers, tagFilter, regionFilter, sortBy, regionById])
  const deleteMutation = useDeleteCustomer()
  const queryClient = useQueryClient()
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null)

  async function confirmDelete() {
    if (!customerToDelete) return
    await deleteMutation.mutateAsync(customerToDelete.id)
    setCustomerToDelete(null)
  }

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const summary = await importCustomerRows(rows, allCustomers)
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
                {
                  header: 'Bölge',
                  value: (c) => {
                    const region = c.region_id ? regionById.get(c.region_id) : undefined
                    return region ? regionLabel(region, regionById) : ''
                  },
                },
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
        {regions.length > 0 && (
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Bölge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_REGIONS}>Tüm Bölgeler</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region.id} value={region.id}>
                  {regionLabel(region, regionById)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                <TableHead>İl</TableHead>
                <TableHead>Ödeme Vadesi</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead>Etiketler</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Doktor bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    <Link to={`/musteriler/${customer.id}`} className="inline-flex items-center gap-2 hover:underline">
                      <Avatar className="size-6">
                        {customer.photo_url && <AvatarImage src={customer.photo_url} alt={customer.full_name} />}
                        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                          {getInitials(customer.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {customer.is_vip && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
                      {customer.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {formatTrPhoneForDisplay(customer.phone)}
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
                  <TableCell className="text-muted-foreground">
                    {customer.province ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {customer.province}
                      </span>
                    ) : (
                      '—'
                    )}
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
                      <Button variant="ghost" size="icon" onClick={() => setCustomerToDelete(customer)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
