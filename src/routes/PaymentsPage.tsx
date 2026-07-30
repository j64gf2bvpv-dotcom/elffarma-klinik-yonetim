import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, ExternalLink, Banknote, CreditCard, ArrowLeftRight, Wallet } from 'lucide-react'
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
import { InstallmentPlanForm } from '@/features/payments/InstallmentPlanForm'
import { CollectInstallmentDialog } from '@/features/payments/CollectInstallmentDialog'
import {
  useAllInstallments,
  useDeleteInstallmentPlan,
  useDeletePayment,
  useInstallmentPlans,
  usePayments,
} from '@/features/payments/hooks'
import { createPayment, type PaymentWithCustomer } from '@/features/payments/api'
import { calculateReceivablesRisk } from '@/features/payments/calculateReceivablesRisk'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { tr } from '@/i18n/tr'
import { ExportMenu } from '@/components/ExportMenu'
import { ImportMenu } from '@/components/ImportMenu'
import { readCell, parseFlexibleDate, type ImportSummary } from '@/lib/importData'
import type { PaymentMethod } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

interface KasaRow {
  date: string
  nakit: number
  kredi_karti: number
  havale: number
  pos: number
  cek: number
  senet: number
  total: number
}

function buildKasaRows(payments: PaymentWithCustomer[]): KasaRow[] {
  const byDay = new Map<string, KasaRow>()
  for (const p of payments) {
    const day = format(new Date(p.paid_at), 'yyyy-MM-dd')
    const row =
      byDay.get(day) ?? { date: day, nakit: 0, kredi_karti: 0, havale: 0, pos: 0, cek: 0, senet: 0, total: 0 }
    row[p.payment_method] += Number(p.amount)
    row.total += Number(p.amount)
    byDay.set(day, row)
  }
  return Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date))
}

export function PaymentsPage() {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const { data: payments = [], isLoading } = usePayments({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  })
  const deleteMutation = useDeletePayment()
  const queryClient = useQueryClient()
  const { data: allPayments = [] } = usePayments({})
  const { data: doctors = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalsByMethod = payments.reduce(
    (acc, p) => {
      acc[p.payment_method] += Number(p.amount)
      return acc
    },
    { nakit: 0, kredi_karti: 0, havale: 0, pos: 0, cek: 0, senet: 0 },
  )
  const kasaRows = React.useMemo(() => buildKasaRows(payments), [payments])

  const { data: installmentPlans = [] } = useInstallmentPlans()
  const { data: allInstallments = [] } = useAllInstallments()
  const deletePlanMutation = useDeleteInstallmentPlan()
  const riskRows = React.useMemo(() => calculateReceivablesRisk(allInstallments), [allInstallments])
  const unpaidInstallments = allInstallments.filter((i) => !i.paid_payment_id)

  const paymentMethodByLabel = React.useMemo(() => {
    const map = new Map<string, PaymentMethod>()
    for (const [key, label] of Object.entries(tr.paymentMethod)) map.set(label.toLocaleLowerCase('tr'), key as PaymentMethod)
    return map
  }, [])

  async function handleImport(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const existingKeys = new Set(
      allPayments.map((p) => `${p.customer_id}|${format(new Date(p.paid_at), 'yyyy-MM-dd')}|${Number(p.amount)}|${p.payment_method}`),
    )
    const summary: ImportSummary = { added: 0, skipped: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowLabel = `Satır ${i + 2}`
      const doctorName = readCell(row, 'Doktor', 'Ad Soyad')
      const amountText = readCell(row, 'Tutar')
      const dateText = readCell(row, 'Tarih')
      if (!doctorName || !amountText || !dateText) {
        summary.errors.push(`${rowLabel}: Doktor, Tutar veya Tarih eksik`)
        continue
      }
      const doctor = doctors.find((d) => d.full_name.toLocaleLowerCase('tr') === doctorName.toLocaleLowerCase('tr'))
      if (!doctor) {
        summary.errors.push(`${rowLabel}: "${doctorName}" adında doktor bulunamadı`)
        continue
      }
      const paidAt = parseFlexibleDate(dateText)
      if (!paidAt) {
        summary.errors.push(`${rowLabel}: Geçersiz tarih (${dateText})`)
        continue
      }
      const amount = Number(amountText.replace(/[^\d.-]/g, ''))
      if (!amount || amount <= 0) {
        summary.errors.push(`${rowLabel}: Geçersiz tutar (${amountText})`)
        continue
      }
      const methodText = readCell(row, 'Yöntem').toLocaleLowerCase('tr')
      const paymentMethod = paymentMethodByLabel.get(methodText) ?? 'nakit'
      const repName = readCell(row, 'Satış Temsilcisi')
      const rep = repName ? salesReps.find((r) => r.name.toLocaleLowerCase('tr') === repName.toLocaleLowerCase('tr')) : undefined

      const key = `${doctor.id}|${format(paidAt, 'yyyy-MM-dd')}|${amount}|${paymentMethod}`
      if (existingKeys.has(key)) {
        summary.skipped++
        continue
      }

      try {
        await createPayment({
          customer_id: doctor.id,
          amount,
          payment_method: paymentMethod,
          description: readCell(row, 'Açıklama') || null,
          paid_at: paidAt.toISOString(),
          sales_rep_id: rep?.id ?? null,
        })
        existingKeys.add(key)
        summary.added++
      } catch (err) {
        summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`)
      }
    }

    if (summary.added > 0) await queryClient.invalidateQueries({ queryKey: ['payments'] })
    return summary
  }

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
            <ImportMenu
              onImport={handleImport}
              templateFilename="tahsilat-sablon"
              templateHeaders={['Doktor', 'Tutar', 'Tarih', 'Yöntem', 'Satış Temsilcisi', 'Açıklama']}
              templateSampleRows={[
                {
                  Doktor: 'Dr. Ayşe Yılmaz',
                  Tutar: 5000,
                  Tarih: '15.03.2026',
                  Yöntem: 'Nakit',
                  'Satış Temsilcisi': '',
                  Açıklama: '',
                },
              ]}
            />
            <InstallmentPlanForm />
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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Banknote className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Nakit</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={currency(totalsByMethod.nakit)}>
                {currency(totalsByMethod.nakit)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CreditCard className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Kredi Kartı</p>
              <p
                className="mt-1 truncate text-lg font-semibold tabular-nums"
                title={currency(totalsByMethod.kredi_karti)}
              >
                {currency(totalsByMethod.kredi_karti)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.55_0.18_250)]/15 text-[oklch(0.55_0.18_250)]">
              <ArrowLeftRight className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Havale</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={currency(totalsByMethod.havale)}>
                {currency(totalsByMethod.havale)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <CreditCard className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">POS</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={currency(totalsByMethod.pos)}>
                {currency(totalsByMethod.pos)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Banknote className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Çek</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={currency(totalsByMethod.cek)}>
                {currency(totalsByMethod.cek)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Banknote className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Senet</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums" title={currency(totalsByMethod.senet)}>
                {currency(totalsByMethod.senet)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {kasaRows.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex-row items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <CardTitle className="text-base">Kasa Özeti — Günlük Döküm</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Nakit</TableHead>
                  <TableHead>Kredi Kartı</TableHead>
                  <TableHead>Havale</TableHead>
                  <TableHead>POS</TableHead>
                  <TableHead>Çek</TableHead>
                  <TableHead>Senet</TableHead>
                  <TableHead>Gün Toplamı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kasaRows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">
                      {format(new Date(row.date), 'd MMMM yyyy, EEEE', { locale: trLocale })}
                    </TableCell>
                    <TableCell>{row.nakit > 0 ? currency(row.nakit) : '—'}</TableCell>
                    <TableCell>{row.kredi_karti > 0 ? currency(row.kredi_karti) : '—'}</TableCell>
                    <TableCell>{row.havale > 0 ? currency(row.havale) : '—'}</TableCell>
                    <TableCell>{row.pos > 0 ? currency(row.pos) : '—'}</TableCell>
                    <TableCell>{row.cek > 0 ? currency(row.cek) : '—'}</TableCell>
                    <TableCell>{row.senet > 0 ? currency(row.senet) : '—'}</TableCell>
                    <TableCell className="font-semibold">{currency(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {riskRows.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Risk Analizi — Vadesi Geçen Taksitler</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doktor</TableHead>
                  <TableHead>Geciken Taksit</TableHead>
                  <TableHead>Geciken Tutar</TableHead>
                  <TableHead>En Uzun Gecikme</TableHead>
                  <TableHead>Tahmini Gecikme Faizi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskRows.map((row) => (
                  <TableRow key={row.customerId}>
                    <TableCell className="font-medium">{row.customerName}</TableCell>
                    <TableCell>{row.overdueCount}</TableCell>
                    <TableCell className="text-destructive">{currency(row.overdueAmount)}</TableCell>
                    <TableCell>{row.maxDaysOverdue} gün</TableCell>
                    <TableCell>{row.estimatedLateFee > 0 ? currency(row.estimatedLateFee) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {installmentPlans.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Taksitli Tahsilat Planları</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            {installmentPlans.map((plan) => {
              const planInstallments = unpaidInstallments.filter((i) => i.plan_id === plan.id)
              return (
                <div key={plan.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{plan.customers?.full_name ?? '—'}</p>
                      <p className="text-muted-foreground text-xs">
                        {currency(Number(plan.total_amount))} / {plan.installment_count} taksit
                        {plan.description ? ` — ${plan.description}` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deletePlanMutation.mutate(plan.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                  {planInstallments.length === 0 ? (
                    <p className="text-success text-sm">Tüm taksitler tahsil edildi.</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {planInstallments.map((installment) => (
                        <div key={installment.id} className="flex items-center justify-between text-sm">
                          <span>
                            Taksit {installment.installment_no} —{' '}
                            {format(new Date(installment.due_date), 'd MMM yyyy', { locale: trLocale })}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{currency(Number(installment.amount))}</span>
                            <CollectInstallmentDialog installment={installment} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

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
