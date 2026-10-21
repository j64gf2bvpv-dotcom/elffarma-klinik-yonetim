import * as React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ChevronDown, ChevronRight, ExternalLink, PackageCheck, PackageOpen, Plus, Search, ShoppingCart, Trash2, Wallet, Receipt } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import {
  useAllPendingProducts,
  useCreatePendingProduct,
  useCustomers,
  useDeletePendingProduct,
  useUpdateCustomerFields,
  useUpdatePendingProduct,
} from '@/features/customers/hooks'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { usePayments, useUpdatePayment } from '@/features/payments/hooks'
import { useCreateSale, useDeleteSale, useSales, useUpdateSale } from '@/features/sales/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { trFold } from '@/lib/detectProvince'
import { cn } from '@/lib/utils'
import { tr } from '@/i18n/tr'
import type { Customer, CustomerPendingProduct, Invoice, Payment, Product, Sale } from '@/types/database'

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
 *
 * Elle giriş (kullanıcı isteği, 2026-10-21: "isim, adet, aldığı ve alacağı
 * ürünler manuel girilebilmeli"): detayda aldığı ürün (satış) ve alacağı ürün
 * doğrudan eklenir; ürün adı serbest yazılır (stoktaki ürünler öneri olarak
 * gelir). Stoktaki bir ürünle eşleşen satış istenirse stoktan düşülür. Alacağı
 * ürünlerin adedi yerinde değiştirilir, "Teslim edildi" ile listeden çıkar.
 * Henüz hiç hareketi olmayan doktor "Doktor ekle" ile listeye alınır.
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
  // "Doktor ekle" ile listeye alınan, henüz hareketi olmayan doktorlar
  const [extraIds, setExtraIds] = React.useState<string[]>([])
  const { data: products = [] } = useProducts('')

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
    for (const id of extraIds) get(id)
    for (const a of by.values()) {
      const paymentTotal = a.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      a.totalDebt = a.boughtAmount + a.invoiceAmount
      a.paid = paymentTotal + a.returnAmount
      a.remaining = a.totalDebt - a.paid
    }
    // Elle eklenen doktorlar en üstte (giriş yapılsın diye), sonra kalan tahsilata göre
    return [...by.values()].sort(
      (x, y) =>
        Number(extraIds.includes(y.customer.id)) - Number(extraIds.includes(x.customer.id)) ||
        y.remaining - x.remaining ||
        y.pendingAmount - x.pendingAmount,
    )
  }, [customers, sales, payments, invoices, pending, extraIds])

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
        <div className="w-60">
          <CustomerCombobox
            value={undefined}
            placeholder="Doktor ekle…"
            onChange={(id) => {
              setExtraIds((prev) => (prev.includes(id) ? prev : [id, ...prev]))
              setOpen((prev) => new Set(prev).add(id))
              setFilter('all')
              setSearch('')
            }}
          />
        </div>
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
                        <EditableName customer={a.customer} />
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
                          <AccountDetail account={a} products={products} />
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

function AccountDetail({ account: a, products }: { account: DoctorAccount; products: Product[] }) {
  const saleRows = [...a.sales, ...a.returns].sort((x, y) => y.sale_date.localeCompare(x.sale_date))
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DetailBlock title="Aldığı Ürünler" total={money(a.boughtAmount - a.returnAmount)}>
        {saleRows.length === 0 && a.invoices.length === 0 && <Empty>Satış yok</Empty>}
        {saleRows.map((s) => (
          <SaleLine key={s.id} sale={s} />
        ))}
        <AddSaleForm customerId={a.customer.id} products={products} />
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
      >
        <p className="-mt-1 text-xs text-muted-foreground">Doktora henüz teslim edilmemiş ürünler</p>
        {a.pending.length === 0 && <Empty>Teslim bekleyen ürün yok</Empty>}
        {a.pending.map((p) => (
          <PendingLine key={p.id} item={p} />
        ))}
        <AddPendingForm customerId={a.customer.id} products={products} />
      </DetailBlock>

      <DetailBlock title="Ödemeler" total={money(a.paid)}>
        {a.payments.length === 0 && a.returns.length === 0 && <Empty>Ödeme yok</Empty>}
        {[...a.payments]
          .sort((x, y) => y.paid_at.localeCompare(x.paid_at))
          .map((p) => (
            <PaymentLine key={p.id} payment={p} />
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

function IconAction({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      {children}
    </button>
  )
}

const PRODUCT_LIST_ID = 'doctor-accounts-products'

/** Stoktaki ürün adları — ürün adı kutularında öneri olarak (serbest yazı da olur). */
function ProductSuggestions({ products }: { products: Product[] }) {
  return (
    <datalist id={PRODUCT_LIST_ID}>
      {products.map((p) => (
        <option key={p.id} value={p.name} />
      ))}
    </datalist>
  )
}

function findProduct(products: Product[], name: string): Product | undefined {
  const key = trFold(name).trim()
  return key ? products.find((p) => trFold(p.name).trim() === key) : undefined
}

const smallInput = 'h-8 px-2 text-sm'

/** Aldığı ürün — satış olarak kaydedilir; stoktaki ürünse istenirse stoktan düşer. */
function AddSaleForm({ customerId, products }: { customerId: string; products: Product[] }) {
  const createSale = useCreateSale()
  const [name, setName] = React.useState('')
  const [qty, setQty] = React.useState('1')
  const [price, setPrice] = React.useState('')
  const [date, setDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [fromStock, setFromStock] = React.useState(true)
  const match = findProduct(products, name)

  function onNameChange(v: string) {
    setName(v)
    const p = findProduct(products, v)
    if (p && !price) setPrice(String(p.unit_price ?? ''))
    // Stokta yoksa "stoktan düş" baştan işaretli gelmesin ("yetersiz stok" hatası vermesin)
    if (p) setFromStock(p.current_quantity > 0)
  }

  async function submit() {
    const quantity = Number(qty)
    const unit = Number(price.replace(',', '.') || 0)
    if (!name.trim()) return toast.error('Ürün adı yazın')
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity) !== quantity) return toast.error('Adet geçerli bir sayı olmalı')
    if (!Number.isFinite(unit) || unit < 0) return toast.error('Fiyat geçerli bir sayı olmalı')
    if (match && fromStock && match.current_quantity < quantity) {
      return toast.error(`Stokta ${match.current_quantity} paket var`, { description: '"Stoktan düş" işaretini kaldırarak stok değişmeden kaydedebilirsiniz.' })
    }
    await createSale.mutateAsync({
      type: 'sale',
      customer_id: customerId,
      product_id: match && fromStock ? match.id : null,
      product_name: match ? match.name : name.trim(),
      quantity,
      unit_price: unit,
      sale_date: date,
    })
    setName('')
    setQty('1')
    setPrice('')
  }

  return (
    <div className="mt-1 grid gap-1.5 rounded-md border border-dashed p-2">
      <ProductSuggestions products={products} />
      <Input className={smallInput} list={PRODUCT_LIST_ID} placeholder="Ürün adı" value={name} onChange={(e) => onNameChange(e.target.value)} />
      <div className="grid grid-cols-[4rem_1fr_8.5rem] gap-1.5">
        <Input className={smallInput} inputMode="numeric" placeholder="Adet" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
        <Input className={smallInput} inputMode="decimal" placeholder="Birim fiyat (TL)" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} />
        <Input className={smallInput} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex items-center justify-between gap-2">
        {match ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <Checkbox checked={fromStock} onCheckedChange={(v) => setFromStock(v === true)} />
            Stoktan düş (stokta {match.current_quantity} paket)
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">{name.trim() ? 'Stokta olmayan ürün — stok değişmez' : ''}</span>
        )}
        <Button type="button" size="sm" className="h-8" onClick={() => void submit()} disabled={createSale.isPending}>
          <Plus className="size-3.5" /> Ekle
        </Button>
      </div>
    </div>
  )
}

/** Alacağı ürün — doktora henüz teslim edilmemiş ürün (stok değişmez). */
function AddPendingForm({ customerId, products }: { customerId: string; products: Product[] }) {
  const createPending = useCreatePendingProduct()
  const [name, setName] = React.useState('')
  const [qty, setQty] = React.useState('1')
  const [price, setPrice] = React.useState('')
  const [note, setNote] = React.useState('')

  function onNameChange(v: string) {
    setName(v)
    const p = findProduct(products, v)
    if (p && !price) setPrice(String(p.unit_price ?? ''))
  }

  async function submit() {
    const quantity = Number(qty)
    const unit = Number(price.replace(',', '.') || 0)
    if (!name.trim()) return toast.error('Ürün adı yazın')
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity) !== quantity) return toast.error('Adet geçerli bir sayı olmalı')
    if (!Number.isFinite(unit) || unit < 0) return toast.error('Fiyat geçerli bir sayı olmalı')
    await createPending.mutateAsync({
      customer_id: customerId,
      product_name: findProduct(products, name)?.name ?? name.trim(),
      quantity,
      unit_price: unit,
      note: note.trim() || null,
    })
    setName('')
    setQty('1')
    setPrice('')
    setNote('')
  }

  return (
    <div className="mt-1 grid gap-1.5 rounded-md border border-dashed p-2">
      <ProductSuggestions products={products} />
      <Input className={smallInput} list={PRODUCT_LIST_ID} placeholder="Ürün adı" value={name} onChange={(e) => onNameChange(e.target.value)} />
      <div className="grid grid-cols-[4rem_1fr] gap-1.5">
        <Input className={smallInput} inputMode="numeric" placeholder="Adet" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
        <Input className={smallInput} inputMode="decimal" placeholder="Birim fiyat (TL)" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} />
      </div>
      <Input className={smallInput} placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end">
        <Button type="button" size="sm" className="h-8" onClick={() => void submit()} disabled={createPending.isPending}>
          <Plus className="size-3.5" /> Ekle
        </Button>
      </div>
    </div>
  )
}

/**
 * Tıklayınca yerinde düzenlenen alan (kullanıcı isteği, 2026-10-21: "hoca ismi,
 * aldığı ürün, toplam tutar vb. bütün kısımlar üzerine tıklanınca manuel
 * girilebilsin"). Enter / dışarı tıklama kaydeder, Esc vazgeçer. Satıra
 * tıklayınca açılıp kapanma tetiklenmesin diye tıklama yukarı iletilmez.
 */
type EditKind = 'text' | 'int' | 'money' | 'date'

function EditableField({
  value,
  kind = 'text',
  onSave,
  children,
  className,
  inputClassName,
  title = 'Düzenlemek için tıklayın',
}: {
  value: string | number | null
  kind?: EditKind
  onSave: (value: string | number) => void
  children: React.ReactNode
  className?: string
  inputClassName?: string
  title?: string
}) {
  const initial = value == null ? '' : kind === 'money' ? String(Math.round(Number(value) * 100) / 100).replace('.', ',') : String(value)
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(initial)

  function start(e: React.MouseEvent) {
    e.stopPropagation()
    setText(initial)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const t = text.trim()
    if (t === initial) return
    if (kind === 'text' || kind === 'date') {
      if (!t && kind === 'date') return
      onSave(t)
      return
    }
    const n = Number(t.replace(/\s/g, '').replace(',', '.'))
    if (!t || !Number.isFinite(n) || n < 0 || (kind === 'int' && (n === 0 || Math.round(n) !== n))) {
      toast.error(kind === 'int' ? 'Adet 0’dan büyük tam sayı olmalı' : 'Geçerli bir tutar yazın')
      return
    }
    onSave(n)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={kind === 'date' ? 'date' : 'text'}
        inputMode={kind === 'int' ? 'numeric' : kind === 'money' ? 'decimal' : undefined}
        value={text}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setText(kind === 'int' ? e.target.value.replace(/\D/g, '') : kind === 'money' ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value)}
        onFocus={(e) => {
          if (kind === 'date') return
          const end = e.currentTarget.value.length
          e.currentTarget.setSelectionRange(end, end)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className={cn('h-7 px-1.5 text-sm', kind === 'int' && 'w-16', kind === 'money' && 'w-28', kind === 'date' && 'w-36', inputClassName)}
      />
    )
  }
  return (
    <button
      type="button"
      title={title}
      onClick={start}
      className={cn('-mx-1 rounded px-1 text-left transition-colors hover:bg-accent hover:ring-1 hover:ring-primary/30', className)}
    >
      {children}
    </button>
  )
}

function EditableName({ customer }: { customer: Customer }) {
  const update = useUpdateCustomerFields()
  return (
    <div>
      <EditableField
        value={customer.full_name}
        onSave={(v) => update.mutate({ id: customer.id, patch: { full_name: String(v) } })}
        className="font-medium"
        inputClassName="w-56"
        title="Doktor adını düzenlemek için tıklayın"
      >
        {customer.full_name}
      </EditableField>
      {customer.province && <p className="text-xs text-muted-foreground">{customer.province}</p>}
    </div>
  )
}

/** Aldığı ürün (satış/iade) satırı — ad, tarih, adet, birim fiyat ve tutar tıklanıp değişir. */
function SaleLine({ sale: s }: { sale: Sale }) {
  const update = useUpdateSale()
  const remove = useDeleteSale()
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) => update.mutate({ sale: s, patch })
  const total = s.quantity * Number(s.unit_price)
  return (
    <DetailLine
      left={
        <>
          <EditableField value={s.product_name} onSave={(v) => save({ product_name: String(v) })} className="font-medium" inputClassName="w-48">
            {s.product_name}
          </EditableField>
          {s.type === 'return' && <Badge variant="secondary" className="ml-1.5">İade</Badge>}
          <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <EditableField value={s.sale_date} kind="date" onSave={(v) => save({ sale_date: String(v) })}>
              {day(s.sale_date)}
            </EditableField>
            ·
            <EditableField value={s.quantity} kind="int" onSave={(v) => save({ quantity: Number(v) })} className="font-medium text-foreground" title={s.product_id ? 'Adedi değiştirin (stok farkı otomatik düzeltilir)' : 'Adedi değiştirin'}>
              {s.quantity} adet
            </EditableField>
            x
            <EditableField value={Number(s.unit_price)} kind="money" onSave={(v) => save({ unit_price: Number(v) })} title="Birim fiyatı değiştirin">
              {money(Number(s.unit_price))}
            </EditableField>
            {s.congress_name ? ` · ${s.congress_name}` : ''}
          </span>
        </>
      }
      right={
        <span className="flex items-center gap-1">
          <EditableField
            value={total}
            kind="money"
            onSave={(v) => save({ unit_price: Math.round((Number(v) / s.quantity) * 100) / 100 })}
            className={cn(s.type === 'return' && 'text-success')}
            title="Tutarı değiştirin (birim fiyat buna göre hesaplanır)"
          >
            {s.type === 'return' ? '−' : ''}
            {money(total)}
          </EditableField>
          <IconAction
            title={s.product_id ? 'Sil (stok geri eklenir)' : 'Sil'}
            onClick={() => {
              if (window.confirm(`"${s.product_name}" kaydı silinsin mi?${s.product_id ? ' Stok geri eklenir.' : ''}`)) remove.mutate(s.id)
            }}
          >
            <Trash2 className="size-3.5" />
          </IconAction>
        </span>
      }
    />
  )
}

/** Alacağı ürün satırı — ad, adet, birim fiyat, tutar ve not tıklanıp değişir; teslim edilince listeden çıkar. */
function PendingLine({ item: p }: { item: CustomerPendingProduct }) {
  const update = useUpdatePendingProduct()
  const remove = useDeletePendingProduct()
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) => update.mutate({ id: p.id, patch })
  const total = p.quantity * Number(p.unit_price)
  return (
    <DetailLine
      left={
        <>
          <EditableField value={p.product_name} onSave={(v) => save({ product_name: String(v) })} className="font-medium" inputClassName="w-48">
            {p.product_name}
          </EditableField>
          <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            {day(p.created_at)} ·
            <EditableField value={p.quantity} kind="int" onSave={(v) => save({ quantity: Number(v) })} className="font-medium text-foreground">
              {p.quantity} adet
            </EditableField>
            x
            <EditableField value={Number(p.unit_price)} kind="money" onSave={(v) => save({ unit_price: Number(v) })}>
              {money(Number(p.unit_price))}
            </EditableField>
            ·
            <EditableField value={p.note ?? ''} onSave={(v) => save({ note: String(v) || null })} inputClassName="w-40">
              {p.note || <span className="italic">not ekle</span>}
            </EditableField>
          </span>
        </>
      }
      right={
        <span className="flex items-center gap-1">
          <EditableField
            value={total}
            kind="money"
            onSave={(v) => save({ unit_price: Math.round((Number(v) / p.quantity) * 100) / 100 })}
            title="Tutarı değiştirin (birim fiyat buna göre hesaplanır)"
          >
            {money(total)}
          </EditableField>
          <button
            type="button"
            title="Teslim edildi — listeden çıkar"
            onClick={() => {
              if (window.confirm(`"${p.product_name}" (${p.quantity} adet) teslim edildi olarak işaretlensin mi? Listeden çıkar; stok değişmez.`)) remove.mutate(p.id)
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
          >
            <PackageCheck className="size-3.5" />
          </button>
        </span>
      }
    />
  )
}

/** Ödeme satırı — ödeme şekli, tarih, açıklama ve tutar tıklanıp değişir. */
function PaymentLine({ payment: p }: { payment: Payment }) {
  const update = useUpdatePayment()
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) => update.mutate({ id: p.id, patch })
  return (
    <DetailLine
      left={
        <>
          <select
            value={p.payment_method}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => save({ payment_method: e.target.value as Payment['payment_method'] })}
            title="Ödeme şeklini değiştirin"
            className="-mx-1 cursor-pointer rounded bg-transparent px-0.5 font-medium hover:bg-accent"
          >
            {Object.entries(tr.paymentMethod).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <EditableField value={p.paid_at.slice(0, 10)} kind="date" onSave={(v) => save({ paid_at: String(v) })}>
              {day(p.paid_at)}
            </EditableField>
            ·
            <EditableField value={p.description ?? ''} onSave={(v) => save({ description: String(v) || null })} inputClassName="w-40">
              {p.description || <span className="italic">açıklama ekle</span>}
            </EditableField>
            {p.invoice_number ? ` · Fatura ${p.invoice_number}` : ''}
          </span>
        </>
      }
      right={
        <EditableField value={Number(p.amount)} kind="money" onSave={(v) => save({ amount: Number(v) })} className="text-success" title="Tutarı değiştirin">
          {money(Number(p.amount))}
        </EditableField>
      }
    />
  )
}
