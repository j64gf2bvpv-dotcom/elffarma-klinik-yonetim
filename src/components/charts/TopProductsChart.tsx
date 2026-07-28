import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TopProductPoint {
  name: string
  qty: number
  revenue: number
}

const rankColors = ['oklch(0.72 0.16 70)', 'oklch(0.68 0.01 0)', 'oklch(0.58 0.13 40)']

function formatCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { payload: TopProductPoint }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{point.name}</p>
      <p className="font-semibold text-popover-foreground">{formatCurrency(point.revenue)}</p>
      <p className="text-muted-foreground text-xs">{point.qty} adet</p>
    </div>
  )
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 0 }} barCategoryGap="30%">
        <defs>
          {data.map((_, i) => (
            <linearGradient key={i} id={`topProductGradient-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={i < 3 ? rankColors[i] : 'var(--color-chart-1)'} stopOpacity={0.55} />
              <stop offset="100%" stopColor={i < 3 ? rankColors[i] : 'var(--color-chart-1)'} stopOpacity={1} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}b` : String(value))}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={118}
          tick={{ fill: 'var(--color-foreground)', fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: 'var(--color-muted)' }} content={<ChartTooltip />} />
        <Bar
          dataKey="revenue"
          radius={[0, 8, 8, 0]}
          maxBarSize={26}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={`url(#topProductGradient-${i})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
