import * as React from 'react'
import { ChevronLeft, ChevronRight, Target, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Badge } from '@/components/ui/badge'
import { useBudgetTargets, useSaveBudgetTarget } from '@/features/budget/hooks'
import { usePayments } from '@/features/payments/hooks'
import { ExportMenu } from '@/components/ExportMenu'

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function TargetCell({ month, initialValue, onSave }: { month: number; initialValue: number; onSave: (month: number, value: number) => void }) {
  const [value, setValue] = React.useState<number | undefined>(initialValue)

  React.useEffect(() => setValue(initialValue), [initialValue])

  return (
    <div
      onBlur={() => {
        if (value != null && value !== initialValue) onSave(month, value)
      }}
    >
      <CurrencyInput value={value} onChange={setValue} className="w-40" />
    </div>
  )
}

export function BudgetYearPage() {
  const [year, setYear] = React.useState(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(null)
  const { data: targets = [] } = useBudgetTargets(year)
  const saveMutation = useSaveBudgetTarget(year)

  const yearStart = new Date(year, 0, 1).toISOString()
  const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString()
  const { data: payments = [] } = usePayments({ from: yearStart, to: yearEnd })

  const actualByMonth = React.useMemo(() => {
    const map = new Map<number, number>()
    for (const p of payments) {
      const m = new Date(p.paid_at).getMonth() + 1
      map.set(m, (map.get(m) ?? 0) + Number(p.amount))
    }
    return map
  }, [payments])

  const targetByMonth = React.useMemo(() => {
    const map = new Map<number, number>()
    for (const t of targets) map.set(t.month, Number(t.target_revenue))
    return map
  }, [targets])

  const rows = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const target = targetByMonth.get(month) ?? 0
        const actual = actualByMonth.get(month) ?? 0
        return { month, name: MONTH_NAMES[i], target, actual, diff: actual - target }
      }),
    [targetByMonth, actualByMonth],
  )

  const totalTarget = rows.reduce((sum, r) => sum + r.target, 0)
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0)
  const totalDiff = totalActual - totalTarget
  const achievementPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : null

  const chartData = rows.map((r) => ({ label: r.name.slice(0, 3), Hedef: r.target, Gerçekleşen: r.actual }))

  function handleSave(month: number, value: number) {
    saveMutation.mutate({ month, targetRevenue: value })
  }

  return (
    <div>
      <PageHeader
        title="Bütçe Yılı"
        description="Aylık ciro hedeflerini girin, gerçekleşen tahsilatlarla karşılaştırın"
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu
              title={`Bütçe Yılı ${year}`}
              filename={`butce-${year}`}
              rows={rows}
              columns={[
                { header: 'Ay', value: (r) => r.name },
                { header: 'Hedef', value: (r) => r.target },
                { header: 'Gerçekleşen', value: (r) => r.actual },
                { header: 'Fark', value: (r) => r.diff },
              ]}
            />
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-16 text-center text-lg font-semibold tabular-nums">{year}</span>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Target className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Yıllık Hedef</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalTarget)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Gerçekleşen</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currency(totalActual)}</p>
              {achievementPct != null && (
                <p className="text-muted-foreground text-xs">Hedefin %{achievementPct.toFixed(0)}'i</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${totalDiff >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}
            >
              {totalDiff >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fark</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${totalDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
                {currency(totalDiff)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Hedef / Gerçekleşen — Aylık</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}b` : String(v))}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-popover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
                formatter={(value) => currency(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Hedef" fill="var(--color-muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Gerçekleşen" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ay</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>Gerçekleşen</TableHead>
                <TableHead>Fark</TableHead>
                <TableHead>Gerçekleşme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pct = r.target > 0 ? (r.actual / r.target) * 100 : null
                return (
                  <TableRow key={r.month} onClick={() => setSelectedMonth(r.month)} selected={r.month === selectedMonth}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <TargetCell month={r.month} initialValue={r.target} onSave={handleSave} />
                    </TableCell>
                    <TableCell className="tabular-nums">{currency(r.actual)}</TableCell>
                    <TableCell className={`tabular-nums ${r.diff >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {currency(r.diff)}
                    </TableCell>
                    <TableCell>
                      {pct == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className={pct >= 100 ? 'border-transparent bg-success/15 text-success' : ''}>
                          %{pct.toFixed(0)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
