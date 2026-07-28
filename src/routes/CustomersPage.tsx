import * as React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Search, Phone, Tag, ReceiptText, MapPin, Building2, User, CalendarClock, FileSpreadsheet, Trash2, Loader2 } from 'lucide-react'
import { getPaymentDueStatus } from '@/lib/paymentDue'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { useCustomers, useDeleteCustomer } from '@/features/customers/hooks'
import { createCustomer, type InvoiceFilter } from '@/features/customers/api'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { ExportMenu } from '@/components/ExportMenu'
import { ExcelImportDialog, type ImportField } from '@/components/ExcelImportDialog'
import { queryClient } from '@/lib/queryClient'
import { turkeyProvinces } from '@/lib/turkeyProvinces'
import type { Customer, DoctorType } from '@/types/database'

const ALL_PROVINCES = '__all__'

const customerImportFields: ImportField[] = [
  { key: 'full_name', label: 'Ad Soyad', required: true, aliases: ['isim', 'doktor', 'doktor adı'] },
  { key: 'phone', label: 'Telefon', required: true, aliases: ['gsm', 'tel', 'telefon numarası'] },
  { key: 'doctor_type', label: 'Tip (Şahıs/Hastane)', aliases: ['tip', 'tür', 'doktor tipi'] },
  { key: 'hospital_name', label: 'Hastane Adı', aliases: ['hastane'] },
  { key: 'province', label: 'İl', aliases: ['il', 'şehir'] },
  { key: 'address', label: 'Adres', aliases: ['adres'] },
  { key: 'tc_no', label: 'TC Kimlik No', aliases: ['tc', 'tc no', 'tc kimlik'] },
  { key: 'tax_number', label: 'Vergi No', aliases: ['vergi no', 'vergi numarası'] },
  { key: 'total_debt', label: 'Ticari Alacaklar', aliases: ['bakiye', 'borç', 'alacak'] },
  { key: 'next_payment_due', label: 'Ödeme Vadesi', aliases: ['vade', 'ödeme tarihi'] },
  { key: 'notes', label: 'Notlar', aliases: ['not', 'açıklama'] },
]

function parseOptionalNumber(v: string): number | null {
  const t = v?.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseOptionalDate(v: string): string | null {
  const t = v?.trim()
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

async function importCustomerRow(row: Record<string, string>) {
  const fullName = row.full_name?.trim()
  if (!fullName) throw new Error('Ad Soyad boş olamaz')
  const phone = row.phone?.trim()
  if (!phone) throw new Error('Telefon boş olamaz')

  const doctorTypeRaw = row.doctor_type?.trim().toLocaleLowerCase('tr-TR')
  const doctor_type: DoctorType = doctorTypeRaw === 'hastane' ? 'hastane' : 'sahis'

  await createCustomer({
    full_name: fullName,
    phone,
    doctor_type,
    hospital_name: row.hospital_name?.trim() || null,
    province: row.province?.trim() || null,
    address: row.address?.trim() || null,
    tc_no: row.tc_no?.trim() || null,
    tax_number: row.tax_number?.trim() || null,
    total_debt: parseOptionalNumber(row.total_debt),
    next_payment_due: parseOptionalDate(row.next_payment_due),
    notes: row.notes?.trim() || null,
    tags: [],
    is_invoiced: false,
  })
}

export function CustomersPage() {
  const [search, setSearch] = React.useState('')
  const [invoiceFilter, setInvoiceFilter] = React.useState<InvoiceFilter>('all')
  const [provinceFilter, setProvinceFilter] = React.useState(ALL_PROVINCES)
  const { data: customers = [], isLoading } = useCustomers(
    search,
    invoiceFilter,
    provinceFilter === ALL_PROVINCES ? undefined : provinceFilter,
  )
  const deleteMutation = useDeleteCustomer()
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null)

  async function confirmDelete() {
    if (!customerToDelete) return
    await deleteMutation.mutateAsync(customerToDelete.id)
    setCustomerToDelete(null)
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
            <ExcelImportDialog
              title="Cari Kartları Excel'den İçe Aktar"
              fields={customerImportFields}
              importRow={importCustomerRow}
              onDone={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
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
                    <Link to={`/musteriler/${customer.id}`} className="hover:underline">
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
