import * as React from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaymentForm } from '@/features/payments/PaymentForm'
import { InvoiceDialog } from '@/features/payments/InvoiceDialog'
import { useDeletePayment, usePayments } from '@/features/payments/hooks'
import type { PaymentWithCustomer } from '@/features/payments/api'
import { tr } from '@/i18n/tr'
import { ExportMenu } from '@/components/ExportMenu'

export function PaymentsPage() {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const { data: payments = [], isLoading } = usePayments({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  })
  const deleteMutation = useDeletePayment()

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div>
      <PageHeader
        title="Tahsilatlar"
        description="Doktor ödemelerini kaydedin ve takip edin"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="https://birfatura.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> BirFatura'yı Aç
              </a>
            </Button>
            <ExportMenu<PaymentWithCustomer>
              title="Tahsilat Listesi"
              filename="tahsilatlar"
              rows={payments}
              columns={[
                { header: 'Tarih', value: (p) => format(new Date(p.paid_at), 'd.MM.yyyy HH:mm') },
                { header: 'Doktor', value: (p) => p.customers?.full_name ?? '' },
                { header: 'Tutar', value: (p) => Number(p.amount) },
                { header: 'Yöntem', value: (p) => tr.paymentMethod[p.payment_method] },
                { header: 'Satış Temsilcisi', value: (p) => p.sales_reps?.name ?? '' },
                { header: 'Açıklama', value: (p) => p.description ?? '' },
                { header: 'Fatura No', value: (p) => p.invoice_number ?? '' },
              ]}
            />
            <PaymentForm />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:flex sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Başlangıç</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Bitiş</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Toplam Tahsilat</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl font-semibold">
            {total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Yöntem</TableHead>
                <TableHead>Temsilci</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Tahsilat bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.paid_at), 'd MMM yyyy HH:mm', { locale: trLocale })}</TableCell>
                  <TableCell className="font-medium">{payment.customers?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    {Number(payment.amount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tr.paymentMethod[payment.payment_method]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{payment.sales_reps?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {payment.description ?? '—'}
                  </TableCell>
                  <TableCell>
                    <InvoiceDialog payment={payment} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(payment.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
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
