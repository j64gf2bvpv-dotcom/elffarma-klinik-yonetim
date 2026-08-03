import * as React from 'react'
import { Area, AreaChart } from 'recharts'

export interface SparklinePoint {
  value: number
}

export function Sparkline({
  data,
  color = 'var(--color-chart-1)',
  height = 36,
  width = 80,
}: {
  data: SparklinePoint[]
  color?: string
  height?: number
  width?: number
}) {
  const gradientId = React.useId().replace(/:/g, '')

  return (
    <div className="min-w-0 overflow-hidden" style={{ width, height, maxWidth: width }}>
      <AreaChart width={width} height={height} data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#spark-${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  )
}
