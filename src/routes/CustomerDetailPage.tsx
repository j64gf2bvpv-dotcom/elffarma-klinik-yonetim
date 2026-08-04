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
  Globe,
  AtSign,
  MessageCircle,
  Users,
  Plus,
  Star,
} from 'lucide-react'
import { getPaymentDueStatus } from '@/lib/paymentDue'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { PendingProductDialog } from '@/features/customers/PendingProductDialog'
import {
  useCustomer,
  useCustomerSummary,
  useDeleteCustomer,
  useDeletePendingProduct,
  usePendingProducts,
} from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { PaymentForm } from '@/features/payments/PaymentForm'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useClinic } from '@/features/clinics/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useParticipationsByDoctorName } from '@/features/congresses/hooks'
import { useVisitsByDoctorName } from '@/features/doctorVisits/hooks'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { SampleRequestForm } from '@/features/samples/SampleRequestForm'
import { useSampleRequests, useUpdateSampleRequestStatus } from '@/features/samples/hooks'
import { CrmActivityForm } from '@/features/crm/CrmActivityForm'
import { CrmOpportunityForm } from '@/features/crm/CrmOpportunityForm'
import { useCrmActivities, useCrmOpportunities } from '@/features/crm/hooks'
import { Checkbox } from '@/components/ui/checkbox'
import { WhatsAppSendDialog } from '@/features/whatsapp/WhatsAppSendDialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n/tr'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id)
  const { data: payments = [] } = usePayments({ customerId: id })
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()
  const { data: pendingProducts = [] } = usePendingProducts(id)
  const { data: clinic } = useClinic(customer?.clinic_id ?? undefined)
  const { data: salesReps = [] } = useSalesReps()
  const { data: congressParticipations = [] } = useParticipationsByDoctorName(customer?.full_name)
  const { data: visits = [] } = useVisitsByDoctorName(customer?.full_name)
  const { data: sampleRequests = [] } = useSampleRequests({ customerId: id })
  const updateSampleStatusMutation = useUpdateSampleRequestStatus()
  const { data: crmOpportunities = [] } = useCrmOpportunities({ customerId: id })
  const { data: crmActivities = [] } = useCrmActivities({ customerId: id })
  const summary = useCustomerSummary(customer)
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
  const salesRep = salesReps.find((r) => r.id === customer.sales_rep_id)

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
        title={
          <span className="flex items-center gap-2.5">
            <Avatar className="size-8">
              {customer.photo_url && <AvatarImage src={customer.photo_url} alt={customer.full_name} />}
              <AvatarFallback className="bg-primary/10 text-primary">{getInitials(customer.full_name)}</AvatarFallback>
            </Avatar>
            {customer.full_name}
          </span>
        }
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

      <div className="mb-6 flex flex-wrap gap-1.5">
        {customer.is_vip && (
          <Badge variant="warning">
            <Star className="size-3" /> VIP
          </Badge>
        )}
        {customer.doctor_code && <Badge variant="outline">{customer.doctor_code}</Badge>}
        <Badge variant={customer.is_active ? 'secondary' : 'destructive'}>
          {customer.is_active ? 'Aktif' : 'Pasif'}
        </Badge>
        {customer.doctor_type === 'hastane' ? (
          <Badge variant="outline">
            <Building2 className="size-3" /> {customer.hospital_name || 'Hastane'}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <User className="size-3" /> Şahıs
          </Badge>
        )}
        {customer.specialty && <Badge variant="outline">{customer.specialty}</Badge>}
        {clinic && (
          <Badge variant="outline">
            <Building2 className="size-3" /> {clinic.name}
          </Badge>
        )}
        {salesRep && (
          <Badge variant="outline">
            <Users className="size-3" /> {salesRep.name}
          </Badge>
        )}
        {customer.province && (
          <Badge variant="outline">
            <MapPin className="size-3" /> {customer.province}
            {customer.district ? ` / ${customer.district}` : ''}
          </Badge>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">TOPLAM SATIŞ</p>
            <p className="text-lg font-semibold tabular-nums">{currency(summary.totalSold)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">TOPLAM TAHSİLAT</p>
            <p className="text-lg font-semibold tabular-nums text-success">{currency(summary.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">BAKİYE</p>
            <p
              className={cn(
                'text-lg font-semibold tabular-nums',
                summary.remainingBalance && summary.remainingBalance > 0 ? 'text-destructive' : 'text-success',
              )}
            >
              {summary.remainingBalance != null ? currency(summary.remainingBalance) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">SON TAHSİLAT</p>
            <p className="text-lg font-semibold">
              {summary.lastPaymentAt
                ? format(new Date(summary.lastPaymentAt), 'd MMM yyyy', { locale: trLocale })
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="genel">
        <TabsList className="mb-4 h-auto flex-wrap justify-start">
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="iletisim">İletişim</TabsTrigger>
          <TabsTrigger value="finans">Finans</TabsTrigger>
          <TabsTrigger value="satin-almalar">Satın Almalar</TabsTrigger>
          <TabsTrigger value="urunler">Ürünler</TabsTrigger>
          <TabsTrigger value="numuneler">Numuneler</TabsTrigger>
          <TabsTrigger value="workshop">Workshop</TabsTrigger>
          <TabsTrigger value="kongreler">Kongreler</TabsTrigger>
          <TabsTrigger value="ziyaretler">Ziyaretler</TabsTrigger>
          <TabsTrigger value="tahsilat">Tahsilat</TabsTrigger>
          <TabsTrigger value="belgeler">Belgeler</TabsTrigger>
          <TabsTrigger value="mesajlar">Mesajlar</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
        </TabsList>

        <TabsContent value="genel">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Genel Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {customer.referrer && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">REFERANS KİŞİ</p>
                  <p>{customer.referrer}</p>
                </div>
              )}
              {customer.assistant_info && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ASİSTAN</p>
                  <p>{customer.assistant_info}</p>
                </div>
              )}
              {customer.secretary_info && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">SEKRETER</p>
                  <p>{customer.secretary_info}</p>
                </div>
              )}
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
              {!customer.referrer && !customer.assistant_info && !customer.secretary_info && !customer.notes && (
                <p className="text-muted-foreground">Ek bilgi girilmemiş.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iletisim">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">İletişim Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {formatTrPhoneForDisplay(customer.phone)}
              </p>
              {customer.mobile_phone && (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" /> {customer.mobile_phone} (cep)
                </p>
              )}
              {customer.whatsapp_phone && (
                <p className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-muted-foreground" /> {customer.whatsapp_phone}
                </p>
              )}
              {customer.email && (
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a href={`mailto:${customer.email}`} className="hover:underline">
                    {customer.email}
                  </a>
                </p>
              )}
              {customer.website && (
                <p className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <a href={customer.website} target="_blank" rel="noreferrer" className="hover:underline">
                    {customer.website}
                  </a>
                </p>
              )}
              {customer.instagram && (
                <p className="flex items-center gap-2">
                  <AtSign className="size-4 text-muted-foreground" /> {customer.instagram}
                </p>
              )}
              {customer.address && (
                <div className="pt-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">ADRES</p>
                  <p className="whitespace-pre-wrap">{customer.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finans">
          <div className="grid gap-6 md:grid-cols-2">
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
                {customer.next_payment_due && (
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
                  })()
                )}
              </CardContent>
            </Card>

            {(customer.tc_no ||
              customer.address ||
              customer.tax_number ||
              customer.tax_office ||
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
                  {customer.tax_office && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">VERGİ DAİRESİ</p>
                      <p>{customer.tax_office}</p>
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
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="satin-almalar">
          <Card>
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
        </TabsContent>

        <TabsContent value="urunler">
          <div className="mb-3 flex items-center justify-between">
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

        <TabsContent value="numuneler">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Numuneler</h2>
            <SampleRequestForm defaultCustomerId={customer.id} trigger={<Button size="sm"><Plus /> Numune Ekle</Button>} />
          </div>
          <Card>
            <CardContent className={sampleRequests.length === 0 ? 'p-6' : 'grid gap-1 p-4'}>
              {sampleRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz numune verilmemiş.</p>
              ) : (
                sampleRequests.map((r) => {
                  const given = r.status === 'delivered'
                  return (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={given}
                        disabled={updateSampleStatusMutation.isPending}
                        onCheckedChange={(checked) =>
                          updateSampleStatusMutation.mutate({
                            id: r.id,
                            input: { status: checked ? 'delivered' : 'pending' },
                          })
                        }
                      />
                      <span className={cn('flex-1', given && 'text-muted-foreground line-through')}>
                        <span className="font-medium">
                          {r.sample_items
                            .map((item) => `${item.products?.name ?? item.product_id} × ${item.quantity}`)
                            .join(', ')}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {format(new Date(r.request_date), 'd MMMM yyyy', { locale: trLocale })}
                        </span>
                      </span>
                    </label>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workshop">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Workshop modülü yakında eklenecek.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kongreler">
          <Card>
            <CardContent className={congressParticipations.length === 0 ? 'p-6' : 'grid gap-1.5 p-4'}>
              {congressParticipations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kongre katılımı bulunamadı.</p>
              ) : (
                congressParticipations.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{p.congresses?.name ?? 'Kongre'}</p>
                      {p.congresses?.start_date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.congresses.start_date), 'd MMM yyyy', { locale: trLocale })}
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Uçuş {currency(Number(p.flight_cost))} · Kayıt {currency(Number(p.registration_cost))} · Konaklama{' '}
                      {currency(Number(p.accommodation_cost))}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ziyaretler">
          <Card>
            <CardContent className={visits.length === 0 ? 'p-6' : 'grid gap-1.5 p-4'}>
              {visits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ziyaret kaydı bulunamadı.</p>
              ) : (
                visits.map((v) => (
                  <div key={v.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{format(new Date(v.visit_date), 'd MMMM yyyy', { locale: trLocale })}</p>
                      {v.social_media && <span className="text-xs text-muted-foreground">{v.social_media}</span>}
                    </div>
                    {v.notes && <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">{v.notes}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tahsilat">
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
        </TabsContent>

        <TabsContent value="belgeler">
          <AttachmentsPanel ownerType="customer" ownerId={customer.id} />
        </TabsContent>

        <TabsContent value="mesajlar">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Gönderim geçmişi kaydı yakında eklenecek — yukarıdaki "WhatsApp Gönder" butonuyla şablon seçip
              mesaj gönderebilirsiniz.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Fırsatlar</h2>
            <CrmOpportunityForm defaultCustomerId={customer.id} />
          </div>
          <Card className="mb-6">
            <CardContent className={crmOpportunities.length === 0 ? 'p-6' : 'grid gap-1.5 p-4'}>
              {crmOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Fırsat bulunamadı.</p>
              ) : (
                crmOpportunities.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-muted-foreground text-xs">{tr.crmOpportunityStage[o.stage]}</p>
                    </div>
                    {o.amount != null && <span className="font-medium">{currency(Number(o.amount))}</span>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Aktiviteler</h2>
            <CrmActivityForm defaultCustomerId={customer.id} />
          </div>
          <Card>
            <CardContent className={crmActivities.length === 0 ? 'p-6' : 'grid gap-1.5 p-4'}>
              {crmActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aktivite bulunamadı.</p>
              ) : (
                crmActivities.map((a) => (
                  <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {tr.crmActivityType[a.activity_type]}
                        {a.subject ? ` — ${a.subject}` : ''}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(a.occurred_at), 'd MMM yyyy HH:mm', { locale: trLocale })}
                      </span>
                    </div>
                    {a.note && <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">{a.note}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
