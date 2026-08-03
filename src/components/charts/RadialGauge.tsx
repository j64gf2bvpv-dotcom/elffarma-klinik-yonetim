import type * as React from 'react'
import { RadialBar, RadialBarChart, PolarAngleAxis } from 'recharts'

/** Tek-değerli dairesel ilerleme göstergesi (ör. "Tahsilat Hedefi" yüzdesi). */
export function RadialGauge({
  percent,
  size = 128,
  thickness = 12,
  color = 'var(--color-primary)',
  trackColor = 'var(--color-muted)',
  children,
}: {
  percent: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  children?: React.ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const data = [{ value: clamped, fill: color }]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        cx="50%"
        cy="50%"
        innerRadius={size / 2 - thickness}
        outerRadius={size / 2}
        barSize={thickness}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" cornerRadius={thickness / 2} background={{ fill: trackColor }} isAnimationActive={false} />
      </RadialBarChart>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
