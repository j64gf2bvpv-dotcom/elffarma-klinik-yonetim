import * as React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Search, Eye } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InvoicePdfViewer } from '@/components/InvoicePdfViewer'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'
import { useInvoices } from '@/features/invoices/hooks'
import { usePayments } from '@/features/payments/hooks'
import { getInvoiceFileUrl } from '@/features/payments/api'
import { ExportMenu } from '@/components/ExportMenu'

interface EFaturaRow {
  id: string
  date: string
  number: string | null
  customerId: string | null
  customerName: string
  amount: number | null
  filePath: string | null
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function EFaturaPage() {
  const [search, setSearch] = React.useState('')
  const { data: invoices = [] } = useInvoices()
  const { data: payments = [] } = usePayments({})
  const [viewingRow, setViewingRow] = React.useState<EFaturaRow | null>(null)

  const rows = React.useMemo<EFaturaRow[]>(() => {
    const fromInvoices: EFaturaRow[] = invoices.map((inv) => ({
      id: `inv-${inv.id}`,
      date: inv.issue_date,
      number: inv.invoice_number,
      customerId: inv.customer_id,
      customerName: inv.customers?.full_name ?? '—',
      amount: Number(inv.amount),
      filePath: null,
    }))
    const fromPayments: EFaturaRow[] = payments
      .filter((p) => p.invoice_number || p.invoice_file_path)
      .map((p) => ({
        id: `pay-${p.id}`,
        date: p.paid_at,
        number: p.invoice_number,
        customerId: p.customer_id,
        customerName: p.customers?.full_name ?? '—',
        amount: Number(p.amount),
        filePath: p.invoice_file_path,
      }))
    return [...fromInvoices, ...fromPayments].sort((a, b) => b.date.localeCompare(a.date))
  }, [invoices, payments])

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR')
    if (!term) return rows
    return rows.filter(
      (r) => r.customerName.toLocaleLowerCase('tr-TR').includes(term) || (r.number ?? '').toLocaleLowerCase('tr-TR').includes(term),
    )
  }, [rows, search])

  return (
    <div>
      <PageHeader
        title="e-Fatura"
        description="Tüm fatura kayıtları — Satışlar bölümünden kesilen basit fatura kayıtları ile Tahsilatlara eklenen fatura dosyalarının birleşik listesi"
        actions={
          <div className="flex gap-2">
            <ExportMenu<EFaturaRow>
              title="e-Fatura Listesi"
              filename="e-fatura"
              rows={filteredRows}
              columns={[
                { header: 'Tarih', value: (r) => format(new Date(r.date), 'd.MM.yyyy') },
                { header: 'Fatura No', value: (r) => r.number ?? '' },
                { header: 'Doktor', value: (r) => r.customerName },
                { header: 'Tutar', value: (r) => (r.amount != null ? r.amount : '') },
              ]}
            />
            <InvoiceForm />
          </div>
        }
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Doktor veya fatura no ile ara..."
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
                <TableHead>Tarih</TableHead>
                <TableHead>Fatura No</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    Fatura bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(row.date), 'd MMM yyyy', { locale: trLocale })}
                  </TableCell>
                  <TableCell className="font-medium">{row.number || '—'}</TableCell>
                  <TableCell>
                    {row.customerId ? (
                      <Link to={`/musteriler/${row.customerId}`} className="hover:underline">
                        {row.customerName}
                      </Link>
                    ) : (
                      row.customerName
                    )}
                  </TableCell>
                  <TableCell>{row.amount != null ? currency(row.amount) : '—'}</TableCell>
                  <TableCell className="text-right">
                    {row.filePath ? (
                      <Button variant="ghost" size="sm" onClick={() => setViewingRow(row)}>
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

      {viewingRow?.filePath && (
        <InvoicePdfViewer
          open={!!viewingRow}
          onOpenChange={(o) => !o && setViewingRow(null)}
          title={viewingRow.number || 'Fatura'}
          getUrl={() => getInvoiceFileUrl(viewingRow.filePath!)}
        />
      )}
    </div>
  )
}
