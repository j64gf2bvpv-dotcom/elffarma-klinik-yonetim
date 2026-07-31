import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  ArrowLeft,
  Phone,
  Tag,
  Trash2,
  Pencil,
  Loader2,
  MapPin,
  Building2,
  User,
  CalendarClock,
  Package,
  Eye,
  Presentation,
  Files,
  ShoppingCart,
  Wallet,
  Banknote,
  ReceiptText,
  Stethoscope,
  NotebookText,
  CalendarDays,
  FolderOpen,
  Info,
  UserRound,
} from 'lucide-react'
import { getPaymentDueStatus } from '@/lib/paymentDue'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { InvoicePdfViewer } from '@/components/InvoicePdfViewer'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { PendingProductDialog } from '@/features/customers/PendingProductDialog'
import {
  useCustomer,
  useDeleteCustomer,
  useDeletePendingProduct,
  usePendingProducts,
} from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { PaymentForm } from '@/features/payments/PaymentForm'
import { getInvoiceFileUrl } from '@/features/payments/api'
import { useInvoices } from '@/features/invoices/hooks'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'
import { useParticipationsByCustomer } from '@/features/congresses/hooks'
import { useWorkshopParticipationsByCustomer } from '@/features/workshops/hooks'
import { useSales } from '@/features/sales/hooks'
import { useVisitsByCustomer } from '@/features/doctorVisits/hooks'
import { CustomerFilesPanel } from '@/features/customerFiles/CustomerFilesPanel'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { tr } from '@/i18n/tr'

interface CustomerInvoiceRow {
  id: string
  date: string
  number: string | null
  amount: number | null
  filePath: string | null
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id)
  const { data: payments = [] } = usePayments({ customerId: id })
  const { data: pendingProducts = [] } = usePendingProducts(id)
  const { data: allInvoices = [] } = useInvoices()
  const { data: congressParticipations = [] } = useParticipationsByCustomer(id)
  const { data: workshopParticipations = [] } = useWorkshopParticipationsByCustomer(id)
  const { data: allSales = [] } = useSales()
  const { data: visits = [] } = useVisitsByCustomer(id)
  const customerSales = React.useMemo(() => allSales.filter((s) => s.customer_id === id), [allSales, id])
  const deletePendingMutation = useDeletePendingProduct()
  const deleteMutation = useDeleteCustomer()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [viewingInvoice, setViewingInvoice] = React.useState<CustomerInvoiceRow | null>(null)

  const invoiceRows = React.useMemo<CustomerInvoiceRow[]>(() => {
    const fromInvoices: CustomerInvoiceRow[] = allInvoices
      .filter((inv) => inv.customer_id === id)
      .map((inv) => ({ id: `inv-${inv.id}`, date: inv.issue_date, number: inv.invoice_number, amount: Number(inv.amount), filePath: null }))
    const fromPayments: CustomerInvoiceRow[] = payments
      .filter((p) => p.invoice_number || p.invoice_file_path)
      .map((p) => ({
        id: `pay-${p.id}`,
        date: p.paid_at,
        number: p.invoice_number,
        amount: Number(p.amount),
        filePath: p.invoice_file_path,
      }))
    return [...fromInvoices, ...fromPayments].sort((a, b) => b.date.localeCompare(a.date))
  }, [allInvoices, payments, id])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!customer) return <p>Doktor bulunamadı.</p>

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const lastPayment = payments[0]
  const remainingBalance = customer.total_debt != null ? Number(customer.total_debt) - totalPaid : null
  const totalPending = pendingProducts.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price), 0)
  const hasTaxInfo =
    customer.tc_no || customer.tax_number || customer.vat_rate != null || customer.preferred_payment_method
  const hasClinicInfo = customer.hospital_name || customer.province || customer.address

  async function handleDelete() {
    await deleteMutation.mutateAsync(customer!.id)
    setConfirmOpen(false)
    navigate('/musteriler')
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/musteriler')}>
        <ArrowLeft /> Doktorlara Dön
      </Button>

      <PageHeader
        title={customer.full_name}
        actions={
          <div className="flex gap-2">
            <WhatsAppSendDialog customerName={customer.full_name} customerPhone={customer.phone} />
            <CustomerForm customer={customer} trigger={<Button variant="outline"><Pencil /> Düzenle</Button>} />
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 /> Sil
            </Button>
          </div>
        }
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{customer.full_name} silinsin mi?</DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz. Doktora ait cari kart kaydı tamamen silinir.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              Evet, Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="genel">
        <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="genel"><Info className="size-3.5" /> Genel Bilgiler</TabsTrigger>
          <TabsTrigger value="vergi"><ReceiptText className="size-3.5" /> Vergi Bilgileri</TabsTrigger>
          <TabsTrigger value="klinik"><Stethoscope className="size-3.5" /> Klinik Bilgileri</TabsTrigger>
          <TabsTrigger value="urunler"><ShoppingCart className="size-3.5" /> Satın Aldığı Ürünler</TabsTrigger>
          <TabsTrigger value="cari"><Wallet className="size-3.5" /> Cari Hesap</TabsTrigger>
          <TabsTrigger value="tahsilat"><Banknote className="size-3.5" /> Tahsilatlar</TabsTrigger>
          <TabsTrigger value="fatura"><Files className="size-3.5" /> Faturalar</TabsTrigger>
          <TabsTrigger value="kongre"><Presentation className="size-3.5" /> Kongre / Workshop</TabsTrigger>
          <TabsTrigger value="ziyaret"><CalendarDays className="size-3.5" /> Ziyaret Geçmişi</TabsTrigger>
          <TabsTrigger value="notlar"><NotebookText className="size-3.5" /> Notlar</TabsTrigger>
          <TabsTrigger value="dosyalar"><FolderOpen className="size-3.5" /> Dosyalar</TabsTrigger>
        </TabsList>

        <TabsContent value="genel">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Genel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {customer.doctor_type === 'hastane' ? (
                  <Badge variant="outline">
                    <Building2 className="size-3" /> {customer.hospital_name || 'Hastane'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <User className="size-3" /> Şahıs
                  </Badge>
                )}
                {customer.province && (
                  <Badge variant="outline">
                    <MapPin className="size-3" /> {customer.province}
                  </Badge>
                )}
              </div>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {formatTrPhoneForDisplay(customer.phone)}
              </p>
              {customer.next_payment_due &&
                (() => {
                  const status = getPaymentDueStatus(customer.next_payment_due)
                  return (
                    <Badge
                      variant={status === 'overdue' ? 'destructive' : status === 'upcoming' ? 'warning' : 'outline'}
                      className="w-fit"
                    >
                      <CalendarClock className="size-3" /> Ödeme Vadesi:{' '}
                      {format(new Date(customer.next_payment_due), 'd MMMM yyyy', { locale: trLocale })}
                    </Badge>
                  )
                })()}
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      <Tag className="size-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vergi">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Vergi Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {!hasTaxInfo && <p className="text-muted-foreground">Vergi bilgisi girilmedi.</p>}
              {customer.tc_no && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">TC KİMLİK NO</p>
                  <p>{customer.tc_no}</p>
                </div>
              )}
              {customer.tax_number && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">VERGİ NUMARASI</p>
                  <p>{customer.tax_number}</p>
                </div>
              )}
              {customer.vat_rate != null && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">KDV ORANI</p>
                  <p>%{customer.vat_rate}</p>
                </div>
              )}
              {customer.preferred_payment_method && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">TERCİH EDİLEN ÖDEME ŞEKLİ</p>
                  <p>{tr.paymentMethod[customer.preferred_payment_method]}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">FATURA DURUMU</p>
                <Badge variant={customer.is_invoiced ? 'success' : 'outline'} className="mt-1 w-fit">
                  {customer.is_invoiced ? 'Faturalı' : 'Faturasız'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="klinik">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Klinik Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {!hasClinicInfo && <p className="text-muted-foreground">Klinik bilgisi girilmedi.</p>}
              {customer.hospital_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">HASTANE / KLİNİK</p>
                  <p>{customer.hospital_name}</p>
                </div>
              )}
              {customer.province && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">İL</p>
                  <p>{customer.province}</p>
                </div>
              )}
              {customer.address && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ADRES</p>
                  <p className="whitespace-pre-wrap">{customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="urunler">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Ürün</TableHead>
                    <TableHead>Adet</TableHead>
                    <TableHead>Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        Satın alınan ürün bulunamadı
                      </TableCell>
                    </TableRow>
                  )}
                  {customerSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(s.sale_date), 'd MMM yyyy', { locale: trLocale })}
                      </TableCell>
                      <TableCell>
                        {s.type === 'sale' ? (
                          <Badge variant="secondary">Satış</Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/30 text-destructive">
                            İade
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{s.product_name}</TableCell>
                      <TableCell>{s.quantity}</TableCell>
                      <TableCell className="font-medium">{currency(s.quantity * Number(s.unit_price))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cari">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Cari Hesap</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/cari-hesap/${customer.id}`}>Hesabı Görüntüle</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid max-w-sm gap-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">TİCARİ ALACAKLAR</p>
                <p className="text-lg font-semibold tabular-nums">
                  {customer.total_debt != null ? currency(Number(customer.total_debt)) : '—'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">TAHSİLAT</p>
                  {lastPayment && (
                    <p className="text-muted-foreground text-xs">
                      Son: {format(new Date(lastPayment.paid_at), 'd MMMM yyyy', { locale: trLocale })}
                    </p>
                  )}
                </div>
                <p className="text-lg font-semibold tabular-nums text-success">{currency(totalPaid)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">BAKİYE</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${remainingBalance && remainingBalance > 0 ? 'text-destructive' : 'text-success'}`}
                >
                  {remainingBalance != null ? currency(remainingBalance) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tahsilat">
          <div className="mb-3 flex items-center justify-end">
            <PaymentForm defaultCustomerId={customer.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Yöntem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        Tahsilat bulunamadı
                      </TableCell>
                    </TableRow>
                  )}
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.paid_at), 'd MMM yyyy HH:mm', { locale: trLocale })}</TableCell>
                      <TableCell className="font-medium">
                        {Number(p.amount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tr.paymentMethod[p.payment_method]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fatura">
          <div className="mb-3 flex items-center justify-end">
            <InvoiceForm defaultCustomerId={customer.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Fatura No</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Fatura kaydı yok
                      </TableCell>
                    </TableRow>
                  )}
                  {invoiceRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(new Date(row.date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                      <TableCell className="font-medium">{row.number || '—'}</TableCell>
                      <TableCell>{row.amount != null ? currency(row.amount) : '—'}</TableCell>
                      <TableCell className="text-right">
                        {row.filePath ? (
                          <Button variant="ghost" size="sm" onClick={() => setViewingInvoice(row)}>
                            <Eye className="size-3.5" /> Görüntüle
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">Dosya yok</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {viewingInvoice?.filePath && (
            <InvoicePdfViewer
              open={!!viewingInvoice}
              onOpenChange={(o) => !o && setViewingInvoice(null)}
              title={viewingInvoice.number || 'Fatura'}
              getUrl={() => getInvoiceFileUrl(viewingInvoice.filePath!)}
            />
          )}
        </TabsContent>

        <TabsContent value="kongre">
          <Card>
            <CardContent className="grid gap-1.5 p-4">
              {congressParticipations.length === 0 && workshopParticipations.length === 0 && (
                <p className="text-muted-foreground p-2 text-sm">Kongre veya workshop katılımı yok.</p>
              )}
              {congressParticipations.map((p) => (
                <Link
                  key={`congress-${p.id}`}
                  to={`/kongreler/${p.congress_id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <Presentation className="text-muted-foreground size-3.5" />
                    {p.congresses?.name ?? 'Kongre'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.congresses?.start_date
                      ? format(new Date(p.congresses.start_date), 'd MMM yyyy', { locale: trLocale })
                      : ''}
                  </span>
                </Link>
              ))}
              {workshopParticipations.map((p) => (
                <Link
                  key={`workshop-${p.id}`}
                  to={`/workshoplar/${p.workshop_id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <Files className="text-muted-foreground size-3.5" />
                    {p.workshops?.name ?? 'Workshop'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.workshops?.workshop_date
                      ? format(new Date(p.workshops.workshop_date), 'd MMM yyyy', { locale: trLocale })
                      : ''}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ziyaret">
          <Card>
            <CardContent className="grid gap-1.5 p-4">
              {visits.length === 0 && (
                <p className="text-muted-foreground p-2 text-sm">Ziyaret kaydı bulunamadı.</p>
              )}
              {visits.map((v) => (
                <div key={v.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <CalendarDays className="text-muted-foreground size-3.5" />
                      {format(new Date(v.visit_date), 'd MMMM yyyy', { locale: trLocale })}
                    </span>
                    {v.sales_reps?.name && (
                      <Badge variant="secondary">
                        <UserRound className="size-3" /> {v.sales_reps.name}
                      </Badge>
                    )}
                  </div>
                  {v.notes && <p className="text-muted-foreground mt-1">{v.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notlar">
          <Card>
            <CardContent className="p-4 text-sm">
              {customer.notes ? (
                <p className="whitespace-pre-wrap">{customer.notes}</p>
              ) : (
                <p className="text-muted-foreground">Not eklenmedi.</p>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Eksik Ürünler</h2>
            <PendingProductDialog customerId={customer.id} />
          </div>
          <Card>
            <CardContent className={pendingProducts.length === 0 ? '' : 'grid gap-1.5 p-4'}>
              {pendingProducts.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Eksik/teslim edilmemiş ürün yok.</p>
              ) : (
                <>
                  {pendingProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Package className="size-3.5 text-muted-foreground" />
                        {p.product_name}{' '}
                        <span className="text-muted-foreground">
                          × {p.quantity} @ {currency(Number(p.unit_price))}
                        </span>
                        {p.note && <span className="text-xs text-muted-foreground">({p.note})</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currency(Number(p.quantity) * Number(p.unit_price))}</span>
                        <Button variant="ghost" size="icon" onClick={() => deletePendingMutation.mutate(p.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <p className="mt-1 text-right text-sm font-medium">Eksik Ürün Toplamı: {currency(totalPending)}</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dosyalar">
          <CustomerFilesPanel customerId={customer.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
