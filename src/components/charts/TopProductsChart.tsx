import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface TopProductPoint {
  name: string
  qty: number
  revenue: number
}

const rankColors = [
  'oklch(0.72 0.16 70)',
  'oklch(0.68 0.01 0)',
  'oklch(0.58 0.13 40)',
  'oklch(0.55 0.15 260)',
  'oklch(0.55 0.15 155)',
]

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

export function TopProductsChart({ data, height = 200 }: { data: TopProductPoint[]; height?: number }) {
  const outerRadius = Math.min(80, Math.round(height / 2) - 8)
  const innerRadius = Math.round(outerRadius * 0.62)
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div className="grid gap-3">
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={rankColors[i % rankColors.length]} stroke="var(--color-card)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalRevenue)}</p>
          <p className="text-muted-foreground text-xs">Toplam ciro</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        {data.map((point, i) => (
          <div key={point.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: rankColors[i % rankColors.length] }} />
              <span className="truncate">{point.name}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatCurrency(point.revenue)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
