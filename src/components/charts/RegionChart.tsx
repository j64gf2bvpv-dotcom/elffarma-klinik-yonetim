import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface RegionChartPoint {
  province: string
  total: number
}

function formatCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { value?: number; payload: RegionChartPoint }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{point.payload.province}</p>
      <p className="font-semibold text-popover-foreground">{formatCurrency(Number(point.value))}</p>
    </div>
  )
}

export function RegionChart({ data }: { data: RegionChartPoint[] }) {
  const height = Math.max(data.length * 36, 120)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 4, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="province"
          tickLine={false}
          axisLine={false}
          width={84}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltip />} />
        <Bar dataKey="total" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} maxBarSize={18}>
          <LabelList
            dataKey="total"
            position="right"
            formatter={(value: unknown) => formatCurrency(Number(value))}
            style={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
