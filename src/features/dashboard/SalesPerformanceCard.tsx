import * as React from 'react'
import { format, startOfDay, subDays } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SalesPerformanceChart, type SalesPerformancePoint } from '@/components/charts/SalesPerformanceChart'

type RangeOption = '30' | '60' | '90'

const rangeLabels: Record<RangeOption, string> = {
  '30': 'Bu Ay',
  '60': 'Son 2 Ay',
  '90': 'Son 3 Ay',
}

export function SalesPerformanceCard({ timeline }: { timeline: { date: Date; amount: number }[] }) {
  const [range, setRange] = React.useState<RangeOption>('30')

  const data = React.useMemo<SalesPerformancePoint[]>(() => {
    const days = Number(range)
    const now = new Date()
    const buckets = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(subDays(now, i))
      buckets.set(d.toISOString(), 0)
    }
    for (const item of timeline) {
      const key = startOfDay(item.date).toISOString()
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + item.amount)
    }
    return Array.from(buckets.entries()).map(([iso, total]) => ({
      label: format(new Date(iso), 'd MMM', { locale: trLocale }),
      total,
    }))
  }, [timeline, range])

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-primary" /> Satış Performansı
        </CardTitle>
        <Select value={range} onValueChange={(v) => setRange(v as RangeOption)}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(rangeLabels) as RangeOption[]).map((key) => (
              <SelectItem key={key} value={key}>
                {rangeLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1">
        <SalesPerformanceChart data={data} />
      </CardContent>
    </Card>
  )
}
