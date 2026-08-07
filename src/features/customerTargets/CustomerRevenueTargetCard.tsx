import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, subMonths } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Pencil, Loader2, Target } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCustomerRevenueTargets, useSaveCustomerRevenueTarget } from './hooks'
import { cn } from '@/lib/utils'
import type { Payment } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const schema = z.object({ target_revenue: z.coerce.number().min(0) })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

/** Bu ayın hedefini belirleme/düzenleme diyaloğu — Cari Kart'taki "Aylık Hedef" kartının kalem ikonundan açılır. */
function EditTargetDialog({
  customerId,
  year,
  month,
  currentTarget,
}: {
  customerId: string
  year: number
  month: number
  currentTarget: number
}) {
  const [open, setOpen] = React.useState(false)
  const saveMutation = useSaveCustomerRevenueTarget(customerId)
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { target_revenue: currentTarget },
  })

  React.useEffect(() => {
    if (open) form.reset({ target_revenue: currentTarget })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    await saveMutation.mutateAsync({ year, month, targetRevenue: values.target_revenue })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: trLocale })} Ciro Hedefi
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="target_revenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hedef Tutar</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * gocust referansındaki doktor bazlı "September/October Revenue Target"
 * kartının karşılığı — son 3 ay için hedef/gerçekleşen ilerleme çubuğu.
 * Gerçekleşen tutar bu doktora ait payments'tan (zaten sayfada yüklü) canlı
 * hesaplanır; hedef yoksa "belirlenmedi" gösterilir, uydurma bir rakam yok.
 */
export function CustomerRevenueTargetCard({ customerId, payments }: { customerId: string; payments: Payment[] }) {
  const { data: targets = [] } = useCustomerRevenueTargets(customerId)

  const months = React.useMemo(() => {
    const now = new Date()
    return [0, 1, 2].map((offset) => {
      const d = subMonths(now, offset)
      return { year: d.getFullYear(), month: d.getMonth() + 1, label: format(d, 'MMMM yyyy', { locale: trLocale }) }
    })
  }, [])

  const actualByMonth = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) {
      const d = new Date(p.paid_at)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      map.set(key, (map.get(key) ?? 0) + Number(p.amount))
    }
    return map
  }, [payments])

  const targetByMonth = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const t of targets) map.set(`${t.year}-${t.month}`, Number(t.target_revenue))
    return map
  }, [targets])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="size-4" /> Aylık Hedef
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {months.map(({ year, month, label }) => {
          const key = `${year}-${month}`
          const actual = actualByMonth.get(key) ?? 0
          const target = targetByMonth.get(key) ?? 0
          const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null
          return (
            <div key={key} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium capitalize">{label}</span>
                <div className="flex items-center gap-1">
                  <span className="tabular-nums text-muted-foreground">
                    {currency(actual)}
                    {target > 0 && <> / {currency(target)}</>}
                  </span>
                  <EditTargetDialog customerId={customerId} year={year} month={month} currentTarget={target} />
                </div>
              </div>
              {pct != null ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-warning')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Bu ay için hedef belirlenmedi</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
