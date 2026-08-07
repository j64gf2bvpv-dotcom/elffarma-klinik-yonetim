import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type PerformanceQuadrant = 'zayif' | 'potansiyel' | 'verimli' | 'guclu'

export interface TeamScorePoint {
  id: string
  name: string
  activity: number
  revenue: number
  quadrant: PerformanceQuadrant
}

export const quadrantLabels: Record<PerformanceQuadrant, string> = {
  zayif: 'Zayıf',
  potansiyel: 'Aktif ama Sonuçsuz',
  verimli: 'Az Aktif ama Verimli',
  guclu: 'Güçlü',
}

const quadrantColorVar: Record<PerformanceQuadrant, string> = {
  zayif: 'var(--color-destructive)',
  potansiyel: 'var(--color-warning)',
  verimli: 'var(--color-primary)',
  guclu: 'var(--color-success)',
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { payload: TeamScorePoint }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-popover-foreground">{point.name}</p>
      <p className="text-muted-foreground">Aktivite: {point.activity} · Ciro: {currency(point.revenue)}</p>
      <p className="text-xs" style={{ color: quadrantColorVar[point.quadrant] }}>
        {quadrantLabels[point.quadrant]}
      </p>
    </div>
  )
}

export function TeamScoreScatterChart({
  data,
  medianActivity,
  medianRevenue,
}: {
  data: TeamScorePoint[]
  medianActivity: number
  medianRevenue: number
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="activity"
          name="Aktivite"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          label={{ value: 'Aktivite Sayısı (bu ay)', position: 'insideBottom', offset: -4, fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="revenue"
          name="Ciro"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          tickFormatter={(v) => currency(Number(v))}
          width={80}
          label={{ value: 'Ciro (bu ay)', angle: -90, position: 'insideLeft', fill: 'var(--color-muted-foreground)', fontSize: 12 }}
        />
        <ReferenceLine x={medianActivity} stroke="var(--color-border)" strokeDasharray="4 4" />
        <ReferenceLine y={medianRevenue} stroke="var(--color-border)" strokeDasharray="4 4" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltip />} />
        <Scatter data={data}>
          {data.map((point) => (
            <Cell key={point.id} fill={quadrantColorVar[point.quadrant]} r={7} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
