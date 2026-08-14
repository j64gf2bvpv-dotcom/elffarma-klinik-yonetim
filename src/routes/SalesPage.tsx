import * as React from 'react'
import { format, startOfMonth, subMonths } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ShoppingCart, Undo2, Trash2, BarChart3, FileText, TrendingUp, TrendingDown } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExportMenu } from '@/components/ExportMenu'
import { RevenueChart, type RevenueChartPoint } from '@/components/charts/RevenueChart'
import { SaleForm } from '@/features/sales/SaleForm'
import { useSales, useDeleteSale } from '@/features/sales/hooks'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'
import { useInvoices, useDeleteInvoice } from '@/features/invoices/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useExpenses } from '@/features/expenses/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { cn } from '@/lib/utils'
import type { SaleWithRelations } from '@/features/sales/api'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function netAmount(s: { type: string; quantity: number; unit_price: number }) {
  return (s.type === 'return' ? -1 : 1) * s.quantity * Number(s.unit_price)
}

function filterSalesByDate<T extends { sale_date: string }>(sales: T[], from: string, to: string): T[] {
  return sales.filter((s) => {
    if (from && s.sale_date < from) return false
    if (to && s.sale_date > to) return false
    return true
  })
}

function SalesTab({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  const { data: allSales = [], isLoading } = useSales()
  const deleteMutation = useDeleteSale()
  const recordMovement = useRecordStockMovement()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const sales = React.useMemo(() => filterSalesByDate(allSales, from, to), [allSales, from, to])

  async function handleDelete(sale: SaleWithRelations) {
    if (!confirm(`${sale.product_name} (${sale.quantity} adet) ${sale.type === 'sale' ? 'satış' : 'iade'} kaydı silinsin mi?`)) return
    // Satış/iade silinince stoktaki etkisi de tersine çevrilmeli, aksi halde
    // kayıt silinir ama current_quantity yanlış kalır (kongre ürün panelindeki
    // aynı desen — bkz. CongressStockItemsPanel.handleDelete).
    if (sale.product_id) {
      await recordMovement.mutateAsync({
        product_id: sale.product_id,
        movement_type: sale.type === 'sale' ? 'in' : 'out',
        quantity: sale.quantity,
        reason: `${sale.type === 'sale' ? 'Satış' : 'İade'} kaydı silindi — stok düzeltmesi`,
        note: sale.product_name,
      })
    }
    deleteMutation.mutate(sale.id)
  }

  const totalSales = sales.filter((s) => s.type === 'sale').reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
  const totalReturns = sales
    .filter((s) => s.type === 'return')
    .reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:flex sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="sales-from">Başlangıç</Label>
          <Input id="sales-from" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sales-to">Bitiş</Label>
          <Input id="sales-to" type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShoppingCart className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam Satış</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalSales)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <Undo2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam İade</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalReturns)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
          {!isLoading && sales.length === 0 && (
            <p className="text-muted-foreground p-6">Henüz satış veya iade kaydı yok.</p>
          )}
          {sales.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Doktor</TableHead>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Adet</TableHead>
                  <TableHead>Birim Fiyat</TableHead>
                  <TableHead>Toplam</TableHead>
                  <TableHead>Satış Temsilcisi</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id} onClick={() => setSelectedId(s.id)} selected={s.id === selectedId}>
                    <TableCell>{format(new Date(s.sale_date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                    <TableCell>
                      {s.type === 'sale' ? (
                        <Badge variant="secondary">Satış</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          İade
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{s.customers?.full_name ?? '—'}</TableCell>
                    <TableCell>{s.product_name}</TableCell>
                    <TableCell>{s.quantity}</TableCell>
                    <TableCell>{currency(Number(s.unit_price))}</TableCell>
                    <TableCell className="font-medium">{currency(s.quantity * Number(s.unit_price))}</TableCell>
                    <TableCell>{s.sales_reps?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function IncomeExpenseReport() {
  const sixMonthsAgo = React.useMemo(() => startOfMonth(subMonths(new Date(), 5)), [])
  const { data: payments = [] } = usePayments({ from: sixMonthsAgo.toISOString() })
  const { data: expenses = [] } = useExpenses({ from: sixMonthsAgo.toISOString() })
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null)

  const rows = React.useMemo(() => {
    const buckets = new Map<string, { label: string; income: number; expense: number }>()
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const key = format(d, 'yyyy-MM')
      buckets.set(key, { label: format(d, 'MMM yyyy', { locale: trLocale }), income: 0, expense: 0 })
    }
    for (const p of payments) {
      const key = format(new Date(p.paid_at), 'yyyy-MM')
      if (buckets.has(key)) buckets.get(key)!.income += Number(p.amount)
    }
    for (const e of expenses) {
      const key = format(new Date(e.expense_date), 'yyyy-MM')
      if (buckets.has(key)) buckets.get(key)!.expense += Number(e.amount)
    }
    return Array.from(buckets.values())
  }, [payments, expenses])

  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0)
  const totalExpense = rows.reduce((sum, r) => sum + r.expense, 0)
  const netProfit = totalIncome - totalExpense

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Gelir-Gider Raporu (Son 6 Ay)</CardTitle>
        <ExportMenu
          filename="gelir-gider-raporu"
          title="Gelir-Gider Raporu"
          columns={[
            { header: 'Ay', value: (r) => r.label },
            { header: 'Gelir', value: (r) => r.income },
            { header: 'Gider', value: (r) => r.expense },
            { header: 'Net Kâr', value: (r) => r.income - r.expense },
          ]}
          rows={rows}
        />
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Toplam Gelir</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{currency(totalIncome)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Toplam Gider</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{currency(totalExpense)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Net Kâr</p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums',
                netProfit >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              {currency(netProfit)}
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ay</TableHead>
              <TableHead>Gelir</TableHead>
              <TableHead>Gider</TableHead>
              <TableHead>Net Kâr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label} onClick={() => setSelectedLabel(r.label)} selected={r.label === selectedLabel}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-success">{currency(r.income)}</TableCell>
                <TableCell className="text-destructive">{currency(r.expense)}</TableCell>
                <TableCell className={cn('font-medium', r.income - r.expense >= 0 ? 'text-success' : 'text-destructive')}>
                  {currency(r.income - r.expense)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ReportsTab() {
  const { data: sales = [] } = useSales()

  const byProduct = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) map.set(s.product_name, (map.get(s.product_name) ?? 0) + netAmount(s))
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8) as RevenueChartPoint[]
  }, [sales])

  const byDoctor = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.customers?.full_name ?? 'Bilinmeyen'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  const byRep = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      const name = s.sales_reps?.name ?? 'Belirtilmemiş'
      map.set(name, (map.get(name) ?? 0) + netAmount(s))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  return (
    <div className="grid gap-6">
      <IncomeExpenseReport />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">En Çok Satan / İade Edilen Ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          {byProduct.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz veri yok</p>
          ) : (
            <RevenueChart data={byProduct} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doktor Bazlı Net Satış</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {byDoctor.length === 0 && <p className="text-muted-foreground text-sm">Henüz veri yok</p>}
            {byDoctor.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{d.name}</span>
                <Badge variant="outline">{currency(d.total)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Satış Temsilcisi Bazlı Net Satış</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {byRep.length === 0 && <p className="text-muted-foreground text-sm">Henüz veri yok</p>}
            {byRep.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <Badge variant="outline">{currency(r.total)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InvoicesTab() {
  const { data: invoices = [], isLoading } = useInvoices()
  const deleteMutation = useDeleteInvoice()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading && <p className="text-muted-foreground p-6">Yükleniyor...</p>}
        {!isLoading && invoices.length === 0 && (
          <p className="text-muted-foreground p-6">Henüz fatura kaydı yok.</p>
        )}
        {invoices.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fatura No</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Not</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} onClick={() => setSelectedId(inv.id)} selected={inv.id === selectedId}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{format(new Date(inv.issue_date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                  <TableCell>{inv.customers?.full_name ?? '—'}</TableCell>
                  <TableCell>{currency(Number(inv.amount))}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.note ?? '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(inv.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function SalesPage() {
  const { data: allSales = [] } = useSales()
  const { data: invoices = [] } = useInvoices()
  const [tab, setTab] = React.useState('sales')
  const [salesFrom, setSalesFrom] = React.useState('')
  const [salesTo, setSalesTo] = React.useState('')
  const sales = React.useMemo(
    () => filterSalesByDate(allSales, salesFrom, salesTo),
    [allSales, salesFrom, salesTo],
  )

  return (
    <div>
      <PageHeader
        title="Satışlar"
        description="Satışlar, iadeler, raporlar ve faturalar tek bölümde"
        actions={
          <div className="flex gap-2">
            {tab === 'sales' && (
              <ExportMenu
                filename="satislar"
                title="Satışlar"
                columns={[
                  { header: 'Tarih', value: (r) => r.sale_date },
                  { header: 'Tür', value: (r) => r.type },
                  { header: 'Doktor', value: (r) => r.doctor },
                  { header: 'Ürün', value: (r) => r.product_name },
                  { header: 'Adet', value: (r) => r.quantity },
                  { header: 'Birim Fiyat', value: (r) => r.unit_price },
                  { header: 'Toplam', value: (r) => r.total },
                  { header: 'Satış Temsilcisi', value: (r) => r.sales_rep },
                ]}
                rows={sales.map((s) => ({
                  sale_date: s.sale_date,
                  type: s.type === 'sale' ? 'Satış' : 'İade',
                  doctor: s.customers?.full_name ?? '',
                  product_name: s.product_name,
                  quantity: s.quantity,
                  unit_price: Number(s.unit_price),
                  total: s.quantity * Number(s.unit_price),
                  sales_rep: s.sales_reps?.name ?? '',
                }))}
              />
            )}
            {tab === 'invoices' && (
              <ExportMenu
                filename="faturalar"
                title="Faturalar"
                columns={[
                  { header: 'Fatura No', value: (r) => r.invoice_number },
                  { header: 'Tarih', value: (r) => r.issue_date },
                  { header: 'Doktor', value: (r) => r.doctor },
                  { header: 'Tutar', value: (r) => r.amount },
                  { header: 'Not', value: (r) => r.note },
                ]}
                rows={invoices.map((inv) => ({
                  invoice_number: inv.invoice_number,
                  issue_date: inv.issue_date,
                  doctor: inv.customers?.full_name ?? '',
                  amount: Number(inv.amount),
                  note: inv.note ?? '',
                }))}
              />
            )}
            {tab === 'sales' && <SaleForm />}
            {tab === 'invoices' && <InvoiceForm />}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="sales">
            <ShoppingCart className="size-3.5" /> Satışlar
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="size-3.5" /> Raporlar
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="size-3.5" /> Faturalar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <SalesTab from={salesFrom} to={salesTo} onFromChange={setSalesFrom} onToChange={setSalesTo} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
