import * as React from 'react'
import { Link } from 'react-router-dom'
import { Search, FileSpreadsheet, Wallet, ShoppingCart, Undo2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { useCustomers } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function CariHesapListPage() {
  const [search, setSearch] = React.useState('')
  const { data: customers = [], isLoading } = useCustomers(search)
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()

  const ledgerByCustomer = React.useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>()
    function ensure(id: string) {
      if (!map.has(id)) map.set(id, { debit: 0, credit: 0 })
      return map.get(id)!
    }
    for (const p of allPayments) ensure(p.customer_id).credit += Number(p.amount)
    for (const s of allSales) {
      const entry = ensure(s.customer_id)
      const amount = s.quantity * Number(s.unit_price)
      if (s.type === 'sale') entry.debit += amount
      else entry.credit += amount
    }
    for (const inv of allInvoices) ensure(inv.customer_id).debit += Number(inv.amount)
    return map
  }, [allPayments, allSales, allInvoices])

  const rows = React.useMemo(
    () =>
      customers
        .map((c) => {
          const ledger = ledgerByCustomer.get(c.id) ?? { debit: 0, credit: 0 }
          const debit = ledger.debit + Number(c.total_debt ?? 0)
          return { customer: c, debit, credit: ledger.credit, balance: debit - ledger.credit }
        })
        .sort((a, b) => b.balance - a.balance),
    [customers, ledgerByCustomer],
  )

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0)
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0)

  return (
    <div>
      <PageHeader
        title="Cari Hesap"
        description="Tüm cari kartların satış/fatura/devir bakiyesi (borç) ve tahsilat/iade (alacak) bakiyeleri"
        actions={
          <ExportMenu<(typeof rows)[number]>
            title="Cari Hesap Özeti"
            filename="cari-hesap-ozeti"
            rows={rows}
            columns={[
              { header: 'Ad Soyad', value: (r) => r.customer.full_name },
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
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Genel Bakiye</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${totalDebit - totalCredit > 0 ? 'text-destructive' : 'text-success'}`}
              >
                {currency(totalDebit - totalCredit)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="İsim veya telefon ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Borç</TableHead>
                <TableHead>Alacak</TableHead>
                <TableHead>Bakiye</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Cari kayıt bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.customer.id}>
                  <TableCell className="font-medium">
                    <Link to={`/cari-hesap/${r.customer.id}`} className="hover:underline">
                      {r.customer.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.debit > 0 ? currency(r.debit) : '—'}</TableCell>
                  <TableCell className="text-success">{r.credit > 0 ? currency(r.credit) : '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.balance > 0
                          ? 'animate-alert-glow-red border-transparent bg-destructive/15 text-destructive'
                          : 'border-transparent bg-success/15 text-success'
                      }
                    >
                      {currency(r.balance)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/cari-hesap/${r.customer.id}`}>
                        <FileSpreadsheet className="size-3.5" /> Ekstre
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
