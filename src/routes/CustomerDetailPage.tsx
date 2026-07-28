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
  Mail,
  Wallet,
  ShoppingCart,
  Undo2,
  Receipt,
  History,
} from 'lucide-react'
import { getPaymentDueStatus } from '@/lib/paymentDue'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
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
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n/tr'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id)
  const { data: payments = [] } = usePayments({ customerId: id })
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()
  const { data: pendingProducts = [] } = usePendingProducts(id)
  const deletePendingMutation = useDeletePendingProduct()
  const deleteMutation = useDeleteCustomer()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

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

  const activityTimeline = [
    ...payments.map((p) => ({
      key: `payment-${p.id}`,
      date: p.paid_at,
      icon: Wallet,
      tone: 'success' as const,
      title: 'Tahsilat',
      subtitle: tr.paymentMethod[p.payment_method],
      amount: Number(p.amount),
    })),
    ...allSales
      .filter((s) => s.customer_id === customer.id)
      .map((s) => ({
        key: `sale-${s.id}`,
        date: s.sale_date,
        icon: s.type === 'return' ? Undo2 : ShoppingCart,
        tone: s.type === 'return' ? ('success' as const) : ('neutral' as const),
        title: s.type === 'return' ? 'İade' : 'Satış',
        subtitle: s.product_name,
        amount: (s.type === 'return' ? -1 : 1) * s.quantity * Number(s.unit_price),
      })),
    ...allInvoices
      .filter((inv) => inv.customer_id === customer.id)
      .map((inv) => ({
        key: `invoice-${inv.id}`,
        date: inv.issue_date,
        icon: Receipt,
        tone: 'neutral' as const,
        title: `Fatura ${inv.invoice_number}`,
        subtitle: inv.note ?? '',
        amount: Number(inv.amount),
      })),
  ].sort((a, b) => b.date.localeCompare(a.date))

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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="grid gap-6 md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">İletişim Bilgileri</CardTitle>
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
            {customer.email && (
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </p>
            )}
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
            {customer.notes && (
              <div className="pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">NOTLAR</p>
                <p className="whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Cari Hesap</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/cari-hesap/${customer.id}`}>Hesabı Görüntüle</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
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

        {(customer.tc_no ||
          customer.address ||
          customer.tax_number ||
          customer.vat_rate != null ||
          customer.preferred_payment_method) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Fatura Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
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
              {customer.address && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ADRES</p>
                  <p className="whitespace-pre-wrap">{customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </div>

        <div className="md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <History className="size-4 text-primary" />
            <h2 className="text-base font-semibold">İşlem Geçmişi</h2>
          </div>
          <Card className="mb-6">
            <CardContent className="grid gap-2 p-4">
              {activityTimeline.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">Henüz işlem yok</p>
              )}
              {activityTimeline.map((item) => (
                <div key={item.key} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg',
                      item.tone === 'success' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <item.icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.subtitle} · {format(new Date(item.date), 'd MMM yyyy', { locale: trLocale })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-medium tabular-nums',
                      item.amount < 0 ? 'text-destructive' : item.tone === 'success' ? 'text-success' : '',
                    )}
                  >
                    {item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Tahsilatlar</h2>
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

          <div className="mt-6 mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Eksik Ürünler</h2>
            <PendingProductDialog customerId={customer.id} />
          </div>
          <Card>
            <CardContent className={pendingProducts.length === 0 ? '' : 'grid gap-1.5 p-4'}>
              {pendingProducts.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Eksik/teslim edilmemiş ürün yok.
                </p>
              ) : (
                <>
                  {pendingProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="size-3.5 text-muted-foreground" />
                        {p.product_name}{' '}
                        <span className="text-muted-foreground">
                          × {p.quantity} @ {currency(Number(p.unit_price))}
                        </span>
                        {p.note && <span className="text-xs text-muted-foreground">({p.note})</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {currency(Number(p.quantity) * Number(p.unit_price))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deletePendingMutation.mutate(p.id)}
                        >
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
        </div>
      </div>
    </div>
  )
}
