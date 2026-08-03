import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface SalesPerformancePoint {
  label: string
  total: number
}

function formatCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { value?: number; payload: SalesPerformancePoint }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{point.payload.label}</p>
      <p className="font-semibold text-popover-foreground">{formatCurrency(Number(point.value))}</p>
    </div>
  )
}

export function SalesPerformanceChart({ data, height = 240 }: { data: SalesPerformancePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="sales-performance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}K` : String(value))}
        />
        <Tooltip cursor={{ stroke: 'var(--color-chart-1)', strokeWidth: 1, strokeDasharray: '4 4' }} content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--color-chart-1)"
          strokeWidth={2.5}
          fill="url(#sales-performance-fill)"
          dot={{ r: 3, fill: 'var(--color-chart-1)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
