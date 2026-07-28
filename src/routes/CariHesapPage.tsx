import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ArrowLeft, Loader2, Wallet, ShoppingCart, Undo2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { useCustomer } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

interface LedgerRow {
  date: string
  type: 'Tahsilat' | 'Satış' | 'İade' | 'Fatura'
  description: string
  debit: number
  credit: number
}

export function CariHesapPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading: loadingCustomer } = useCustomer(id)
  const { data: payments = [] } = usePayments({ customerId: id })
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()

  const sales = React.useMemo(() => allSales.filter((s) => s.customer_id === id), [allSales, id])
  const invoices = React.useMemo(() => allInvoices.filter((inv) => inv.customer_id === id), [allInvoices, id])

  const rows = React.useMemo<LedgerRow[]>(() => {
    const list: LedgerRow[] = []
    for (const p of payments) {
      list.push({
        date: p.paid_at,
        type: 'Tahsilat',
        description: p.description || 'Tahsilat',
        debit: 0,
        credit: Number(p.amount),
      })
    }
    for (const s of sales) {
      const amount = s.quantity * Number(s.unit_price)
      if (s.type === 'sale') {
        list.push({ date: s.sale_date, type: 'Satış', description: s.product_name, debit: amount, credit: 0 })
      } else {
        list.push({ date: s.sale_date, type: 'İade', description: s.product_name, debit: 0, credit: amount })
      }
    }
    for (const inv of invoices) {
      list.push({
        date: inv.issue_date,
        type: 'Fatura',
        description: `Fatura No: ${inv.invoice_number}`,
        debit: Number(inv.amount),
        credit: 0,
      })
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [payments, sales, invoices])

  let running = 0
  const rowsWithBalance = rows.map((r) => {
    running += r.debit - r.credit
    return { ...r, balance: running }
  })

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0)
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0)

  if (loadingCustomer) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!customer) return <p>Cari kayıt bulunamadı.</p>

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/cari-hesap')}>
        <ArrowLeft /> Cari Hesap Listesine Dön
      </Button>

      <PageHeader
        title={`Cari Hesap — ${customer.full_name}`}
        description="Satış (borç) ve tahsilat/iade (alacak) hareketlerinin dökümü"
        actions={
          <ExportMenu<(typeof rowsWithBalance)[number]>
            title={`Cari Hesap Ekstresi — ${customer.full_name}`}
            filename={`cari-hesap-${customer.full_name}`}
            rows={rowsWithBalance}
            columns={[
              { header: 'Tarih', value: (r) => format(new Date(r.date), 'd MMM yyyy', { locale: trLocale }) },
              { header: 'Tür', value: (r) => r.type },
              { header: 'Açıklama', value: (r) => r.description },
              { header: 'Borç', value: (r) => r.debit },
              { header: 'Alacak', value: (r) => r.credit },
              { header: 'Bakiye', value: (r) => r.balance },
            ]}
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <ShoppingCart className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam Borç</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalDebit)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Toplam Alacak</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalCredit)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Undo2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bakiye</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${totalDebit - totalCredit > 0 ? 'text-destructive' : 'text-success'}`}
              >
                {currency(totalDebit - totalCredit)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hesap Hareketleri</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rowsWithBalance.length === 0 ? (
            <p className="text-muted-foreground p-6">Henüz hareket kaydı yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Borç</TableHead>
                  <TableHead>Alacak</TableHead>
                  <TableHead>Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithBalance.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(r.date), 'd MMM yyyy', { locale: trLocale })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.type === 'Satış' || r.type === 'Fatura'
                            ? 'destructive'
                            : r.type === 'Tahsilat'
                              ? 'success'
                              : 'outline'
                        }
                      >
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.description}</TableCell>
                    <TableCell>{r.debit > 0 ? currency(r.debit) : '—'}</TableCell>
                    <TableCell>{r.credit > 0 ? currency(r.credit) : '—'}</TableCell>
                    <TableCell className={`font-medium ${r.balance > 0 ? 'text-destructive' : 'text-success'}`}>
                      {currency(r.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 text-xs">
        Not: Bu ekstre satış/iade ve tahsilat hareketlerinden hesaplanır.{' '}
        <Link to={`/musteriler/${id}`} className="text-primary hover:underline">
          Doktor profilindeki
        </Link>{' '}
        elle girilen "Ticari Alacaklar" tutarı ayrı bir alandır ve bu dökümde yer almaz.
      </p>
    </div>
  )
}
