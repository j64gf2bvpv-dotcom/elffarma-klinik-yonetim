import * as React from 'react'
import { Trash2, Wrench, Receipt as ReceiptIcon } from 'lucide-react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useDeleteExpense, useExpenses } from '@/features/expenses/hooks'
import { ExportMenu } from '@/components/ExportMenu'
import { tr } from '@/i18n/tr'
import type { Expense } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function ExpensesPage() {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { data: expenses = [], isLoading } = useExpenses({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  })
  const deleteMutation = useDeleteExpense()

  const serviceTotal = expenses
    .filter((e) => e.category === 'hizmet_gideri')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const otherTotal = expenses.filter((e) => e.category === 'diger').reduce((sum, e) => sum + Number(e.amount), 0)
  const grandTotal = serviceTotal + otherTotal

  return (
    <div>
      <PageHeader
        title="Giderler"
        description="Hizmet giderlerini ve diğer giderleri kaydedin ve takip edin"
        actions={
          <div className="flex gap-2">
            <ExportMenu<Expense>
              title="Gider Listesi"
              filename="giderler"
              rows={expenses}
              columns={[
                { header: 'Tarih', value: (e) => format(new Date(e.expense_date), 'd.MM.yyyy HH:mm') },
                { header: 'Kategori', value: (e) => tr.expenseCategory[e.category] },
                { header: 'Tutar', value: (e) => Number(e.amount) },
                { header: 'Açıklama', value: (e) => e.description ?? '' },
              ]}
            />
            <ExpenseForm />
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wrench className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hizmet Gideri</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(serviceTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <ReceiptIcon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Diğer Giderler</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(otherTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Toplam Gider</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold tabular-nums">{currency(grandTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Gider bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {expenses.map((expense) => (
                <TableRow
                  key={expense.id}
                  onClick={() => setSelectedId(expense.id)}
                  selected={expense.id === selectedId}
                >
                  <TableCell>
                    {format(new Date(expense.expense_date), 'd MMM yyyy HH:mm', { locale: trLocale })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tr.expenseCategory[expense.category]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{currency(Number(expense.amount))}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {expense.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(expense.id)}>
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
