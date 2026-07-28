import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface StockStatusPoint {
  key: 'in_stock' | 'low_stock' | 'out_of_stock'
  label: string
  value: number
  color: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { payload: StockStatusPoint }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{point.label}</p>
      <p className="text-popover-foreground font-semibold">{point.value} ürün</p>
    </div>
  )
}

export function StockStatusChart({ data }: { data: StockStatusPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={2}>
          {data.map((point) => (
            <Cell key={point.key} fill={point.color} stroke="var(--color-card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
