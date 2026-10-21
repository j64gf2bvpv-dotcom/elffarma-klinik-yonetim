import * as React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ChevronDown, ChevronRight, ExternalLink, PackageOpen, Search, ShoppingCart, Wallet, Receipt } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { useAllPendingProducts, useCustomers } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { PendingProductDialog } from '@/features/customers/PendingProductDialog'
import { trFold } from '@/lib/detectProvince'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n/tr'
import type { Customer, CustomerPendingProduct, Invoice, Payment, Sale } from '@/types/database'

/**
 * Stok > Doktor Hesapları (kullanıcı isteği, 2026-10-21: "borçlu olduğumuz
 * doktor, aldığı / alacağı ürünler, kalan tahsilat, ödenen kısmı — detaylı").
 * Doktor başına:
 *  - Aldığı ürünler: satışlar (iadeler düşülür)
 *  - Alacağı ürünler: "Eksik Ürünler" (customer_pending_products) — doktora
 *    henüz teslim etmediğimiz, yani ona ürün borçlu olduğumuz kalemler
 *  - Toplam tutar / Ödenen / Kalan tahsilat: Cari Hesap ile AYNI formül
 *    (satış + fatura borç; tahsilat + iade alacak — bkz. computeCariLedger),
 *    iki ekran aynı rakamı göstersin diye
 * Satıra tıklayınca satış, teslim bekleyen ürün ve ödeme dökümü açılır.
 */

interface DoctorAccount {
  customer: Customer
  sales: Sale[]
  returns: Sale[]
  invoices: Invoice[]
  payments: Payment[]
  pending: CustomerPendingProduct[]
  boughtQty: number
  boughtAmount: number
  returnAmount: number
  invoiceAmount: number
  pendingQty: number
  pendingAmount: number
  /** satış + fatura */
  totalDebt: number
  /** tahsilat + iade */
  paid: number
  remaining: number
}

type Filter = 'all' | 'remaining' | 'pending' | 'paid'

const money = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`
const day = (d: string) => format(new Date(d), 'd MMM yyyy', { locale: trLocale })

export function DoctorAccountsPanel() {
  const { data: customers = [] } = useCustomers('')
  const { data: sales = [] } = useSales()
  const { data: payments = [] } = usePayments({})
  const { data: invoices = [] } = useInvoices()
  const { data: pending = [] } = useAllPendingProducts()
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [open, setOpen] = React.useState<Set<string>>(new Set())

  const accounts = React.useMemo<DoctorAccount[]>(() => {
    const by = new Map<string, DoctorAccount>()
    const byId = new Map(customers.map((c) => [c.id, c]))
    const get = (id: string) => {
      let a = by.get(id)
      if (!a) {
        const customer = byId.get(id)
        if (!customer) return null
        a = {
          customer, sales: [], returns: [], invoices: [], payments: [], pending: [],
          boughtQty: 0, boughtAmount: 0, returnAmount: 0, invoiceAmount: 0, pendingQty: 0, pendingAmount: 0,
          totalDebt: 0, paid: 0, remaining: 0,
        }
        by.set(id, a)
      }
      return a
    }
    for (const s of sales) {
      const a = get(s.customer_id)
      if (!a) continue
      const amount = s.quantity * Number(s.unit_price)
      if (s.type === 'sale') {
        a.sales.push(s)
        a.boughtQty += s.quantity
        a.boughtAmount += amount
      } else {
        a.returns.push(s)
        a.returnAmount += amount
      }
    }
    for (const inv of invoices) {
      const a = get(inv.customer_id)
      if (!a) continue
      a.invoices.push(inv)
      a.invoiceAmount += Number(inv.amount)
    }
    for (const p of payments) {
      const a = get(p.customer_id)
      if (!a) continue
      a.payments.push(p)
    }
    for (const p of pending) {
      const a = get(p.customer_id)
      if (!a) continue
      a.pending.push(p)
      a.pendingQty += p.quantity
      a.pendingAmount += p.quantity * Number(p.unit_price)
    }
    for (const a of by.values()) {
      const paymentTotal = a.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      a.totalDebt = a.boughtAmount + a.invoiceAmount
      a.paid = paymentTotal + a.returnAmount
      a.remaining = a.totalDebt - a.paid
    }
    return [...by.values()].sort((x, y) => y.remaining - x.remaining || y.pendingAmount - x.pendingAmount)
  }, [customers, sales, payments, invoices, pending])

  const visible = React.useMemo(() => {
    const q = trFold(search).trim()
    return accounts.filter((a) => {
      if (q && !trFold(a.customer.full_name).includes(q) && !trFold(a.customer.province ?? '').includes(q)) return false
      if (filter === 'remaining') return a.remaining > 0.005
      if (filter === 'pending') return a.pending.length > 0
      if (filter === 'paid') return a.totalDebt > 0 && a.remaining <= 0.005
      return true
    })
  }, [accounts, search, filter])

  const totals = React.useMemo(
    () =>
      accounts.reduce(
        (t, a) => ({
          debt: t.debt + a.totalDebt,
          paid: t.paid + a.paid,
          remaining: t.remaining + Math.max(0, a.remaining),
          pendingQty: t.pendingQty + a.pendingQty,
          pendingAmount: t.pendingAmount + a.pendingAmount,
          owing: t.owing + (a.remaining > 0.005 ? 1 : 0),
          pendingDoctors: t.pendingDoctors + (a.pending.length > 0 ? 1 : 0),
        }),
        { debt: 0, paid: 0, remaining: 0, pendingQty: 0, pendingAmount: 0, owing: 0, pendingDoctors: 0 },
      ),
    [accounts],
  )

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const counts = {
    all: accounts.length,
    remaining: totals.owing,
    pending: totals.pendingDoctors,
    paid: accounts.filter((a) => a.totalDebt > 0 && a.remaining <= 0.005).length,
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={ShoppingCart} label="Toplam Satış" value={money(totals.debt)} />
        <SummaryCard icon={Wallet} label="Ödenen" value={money(totals.paid)} tone="success" />
        <SummaryCard icon={Receipt} label="Kalan Tahsilat" value={money(totals.remaining)} hint={`${totals.owing} doktor`} tone="destructive" />
        <SummaryCard
          icon={PackageOpen}
          label="Teslim Bekleyen Ürün"
          value={`${totals.pendingQty} adet`}
          hint={`${money(totals.pendingAmount)} · ${totals.pendingDoctors} doktor`}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Doktor veya il ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Tümü ({counts.all})</TabsTrigger>
            <TabsTrigger value="remaining">Kalan Tahsilatı Olan ({counts.remaining})</TabsTrigger>
            <TabsTrigger value="pending">Alacağı Ürünü Olan ({counts.pending})</TabsTrigger>
            <TabsTrigger value="paid">Ödemesi Tamam ({counts.paid})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto">
          <ExportMenu<DoctorAccount>
            title="Doktor Hesapları"
            filename="doktor-hesaplari"
            rows={visible}
            columns={[
              { header: 'Doktor', value: (a) => a.customer.full_name },
              { header: 'İl', value: (a) => a.customer.province ?? '' },
              { header: 'Aldığı Ürün (adet)', value: (a) => a.boughtQty },
              { header: 'Aldığı Ürünler', value: (a) => summarizeItems(a.sales) },
              { header: 'Alacağı Ürün (adet)', value: (a) => a.pendingQty },
              { header: 'Alacağı Ürünler', value: (a) => summarizeItems(a.pending) },
              { header: 'Toplam Tutar', value: (a) => a.totalDebt },
              { header: 'Ödenen', value: (a) => a.paid },
              { header: 'Kalan Tahsilat', value: (a) => a.remaining },
            ]}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="[&_td]:border-b [&_td]:border-border [&_td:not(:last-child)]:border-r [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/40 [&_th:not(:last-child)]:border-r">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Doktor</TableHead>
                <TableHead className="text-center">Aldığı Ürünler</TableHead>
                <TableHead className="text-center">Alacağı Ürünler</TableHead>
                <TableHead className="text-right">Toplam Tutar</TableHead>
                <TableHead className="text-right">Ödenen</TableHead>
                <TableHead className="text-right">Kalan Tahsilat</TableHead>
                <TableHead className="text-center">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {accounts.length === 0 ? 'Henüz satış, tahsilat ya da teslim bekleyen ürün yok' : 'Eşleşen doktor yok'}
                  </TableCell>
                </TableRow>
              )}
              {visible.map((a) => {
                const isOpen = open.has(a.customer.id)
                return (
                  <React.Fragment key={a.customer.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(a.customer.id)}>
                      <TableCell className="text-muted-foreground">
                        {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{a.customer.full_name}</p>
                        {a.customer.province && <p className="text-xs text-muted-foreground">{a.customer.province}</p>}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.boughtQty > 0 ? (
                          <span>
                            {a.boughtQty} adet <span className="text-xs text-muted-foreground">· {a.sales.length} kalem</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.pendingQty > 0 ? (
                          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                            {a.pendingQty} adet · {money(a.pendingAmount)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(a.totalDebt)}</TableCell>
                      <TableCell className="text-right text-success tabular-nums">{money(a.paid)}</TableCell>
                      <TableCell className={cn('text-right font-semibold tabular-nums', a.remaining > 0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                        {money(a.remaining)}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge account={a} />
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-4">
                          <AccountDetail account={a} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function summarizeItems(items: { product_name: string; quantity: number }[]): string {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.product_name, (m.get(i.product_name) ?? 0) + i.quantity)
  return [...m].map(([name, q]) => `${name} x${q}`).join(', ')
}

function StatusBadge({ account: a }: { account: DoctorAccount }) {
  if (a.remaining > 0.005) return <Badge variant="destructive">Borçlu</Badge>
  if (a.remaining < -0.005) return <Badge variant="secondary">Fazla ödeme</Badge>
  if (a.pending.length > 0) return <Badge variant="outline" className="border-warning/40 text-warning-foreground">Ürün bekliyor</Badge>
  if (a.totalDebt > 0) return <Badge className="bg-success text-success-foreground">Ödendi</Badge>
  return <span className="text-muted-foreground">—</span>
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  tone?: 'success' | 'destructive' | 'warning'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'destructive' && 'bg-destructive/10 text-destructive',
            tone === 'warning' && 'bg-warning/15 text-warning-foreground',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function AccountDetail({ account: a }: { account: DoctorAccount }) {
  const saleRows = [...a.sales, ...a.returns].sort((x, y) => y.sale_date.localeCompare(x.sale_date))
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DetailBlock title="Aldığı Ürünler" total={money(a.boughtAmount - a.returnAmount)}>
        {saleRows.length === 0 && a.invoices.length === 0 && <Empty>Satış yok</Empty>}
        {saleRows.map((s) => (
          <DetailLine
            key={s.id}
            left={
              <>
                <span className="font-medium">{s.product_name}</span>
                {s.type === 'return' && <Badge variant="secondary" className="ml-1.5">İade</Badge>}
                <span className="block text-xs text-muted-foreground">
                  {day(s.sale_date)} · {s.quantity} x {money(Number(s.unit_price))}
                  {s.congress_name ? ` · ${s.congress_name}` : ''}
                </span>
              </>
            }
            right={<span className={cn(s.type === 'return' && 'text-success')}>{s.type === 'return' ? '−' : ''}{money(s.quantity * Number(s.unit_price))}</span>}
          />
        ))}
        {a.invoices.map((inv) => (
          <DetailLine
            key={inv.id}
            left={
              <>
                <span className="font-medium">Fatura {inv.invoice_number}</span>
                <span className="block text-xs text-muted-foreground">{day(inv.created_at)}</span>
              </>
            }
            right={money(Number(inv.amount))}
          />
        ))}
      </DetailBlock>

      <DetailBlock
        title="Alacağı Ürünler"
        total={a.pending.length > 0 ? `${a.pendingQty} adet · ${money(a.pendingAmount)}` : undefined}
        action={<PendingProductDialog customerId={a.customer.id} />}
      >
        <p className="-mt-1 text-xs text-muted-foreground">Doktora henüz teslim edilmemiş ürünler</p>
        {a.pending.length === 0 && <Empty>Teslim bekleyen ürün yok</Empty>}
        {a.pending.map((p) => (
          <DetailLine
            key={p.id}
            left={
              <>
                <span className="font-medium">{p.product_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {day(p.created_at)} · {p.quantity} x {money(Number(p.unit_price))}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </>
            }
            right={money(p.quantity * Number(p.unit_price))}
          />
        ))}
      </DetailBlock>

      <DetailBlock title="Ödemeler" total={money(a.paid)}>
        {a.payments.length === 0 && a.returns.length === 0 && <Empty>Ödeme yok</Empty>}
        {[...a.payments]
          .sort((x, y) => y.paid_at.localeCompare(x.paid_at))
          .map((p) => (
            <DetailLine
              key={p.id}
              left={
                <>
                  <span className="font-medium">{tr.paymentMethod[p.payment_method] ?? p.payment_method}</span>
                  <span className="block text-xs text-muted-foreground">
                    {day(p.paid_at)}
                    {p.description ? ` · ${p.description}` : ''}
                    {p.invoice_number ? ` · Fatura ${p.invoice_number}` : ''}
                  </span>
                </>
              }
              right={<span className="text-success">{money(Number(p.amount))}</span>}
            />
          ))}
        {a.returnAmount > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">İadeler ({money(a.returnAmount)}) ödenen tutara dahildir.</p>
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
          <span className="font-medium">Kalan Tahsilat</span>
          <span className={cn('font-semibold', a.remaining > 0.005 ? 'text-destructive' : 'text-muted-foreground')}>{money(a.remaining)}</span>
        </div>
      </DetailBlock>

      <div className="lg:col-span-3">
        <Link to={`/musteriler/${a.customer.id}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="size-3.5" /> Doktorun cari kartını aç
        </Link>
      </div>
    </div>
  )
}

function DetailBlock({ title, total, action, children }: { title: string; total?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex flex-wrap items-center gap-2">
          {total && <span className="text-xs font-medium text-muted-foreground">{total}</span>}
          {action}
        </div>
      </div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  )
}

function DetailLine({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-1.5 text-sm last:border-b-0">
      <div className="min-w-0">{left}</div>
      <div className="shrink-0 tabular-nums">{right}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>
}
