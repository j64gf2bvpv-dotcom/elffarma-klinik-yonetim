import * as React from 'react'
import { turkeyProvincePaths, TURKEY_MAP_VIEWBOX } from '@/lib/turkeyMapPaths'

export interface ProvinceValue {
  province: string
  total: number
}

function formatCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function TurkeyMap({ data }: { data: ProvinceValue[] }) {
  const [hovered, setHovered] = React.useState<string | null>(null)

  const valueByProvince = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const d of data) map.set(d.province, d.total)
    return map
  }, [data])

  const maxValue = React.useMemo(
    () => Math.max(1, ...Array.from(valueByProvince.values())),
    [valueByProvince],
  )

  function colorFor(value: number) {
    if (value <= 0) return 'oklch(0.93 0.006 23)'
    const t = Math.min(1, value / maxValue)
    const l = 0.88 - t * 0.46
    const c = 0.03 + t * 0.19
    return `oklch(${l.toFixed(3)} ${c.toFixed(3)} 23)`
  }

  function textColorFor(value: number) {
    if (value <= 0) return 'transparent'
    const t = Math.min(1, value / maxValue)
    return t > 0.45 ? 'white' : 'oklch(0.35 0.16 23)'
  }

  return (
    <div className="relative">
      <svg viewBox={TURKEY_MAP_VIEWBOX} className="h-auto w-full" style={{ maxHeight: 320 }}>
        <defs>
          <filter id="province-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#000" floodOpacity="0.35" />
          </filter>
          <filter id="province-shadow-hover" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>
        {turkeyProvincePaths.map((p) => {
          const value = valueByProvince.get(p.name) ?? 0
          const isHovered = hovered === p.name
          return (
            <path
              key={p.number}
              d={p.path}
              fill={colorFor(value)}
              stroke="rgba(255,255,255,0.65)"
              strokeWidth={0.6}
              style={{
                filter: isHovered ? 'url(#province-shadow-hover)' : 'url(#province-shadow)',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transition: 'transform 200ms ease, filter 200ms ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                cursor: value > 0 ? 'pointer' : 'default',
                animation: isHovered && value > 0 ? 'map-province-pulse 0.9s ease-in-out infinite' : undefined,
              }}
              onMouseEnter={() => setHovered(p.name)}
              onMouseLeave={() => setHovered((h) => (h === p.name ? null : h))}
            >
              <title>
                {p.name}: {formatCurrency(value)}
              </title>
            </path>
          )
        })}
        {turkeyProvincePaths
          .filter((p) => (valueByProvince.get(p.name) ?? 0) > 0)
          .map((p) => (
            <text
              key={`label-${p.number}`}
              x={p.labelX}
              y={p.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none select-none"
              style={{
                fontSize: 8,
                fontWeight: 600,
                fill: textColorFor(valueByProvince.get(p.name) ?? 0),
                paintOrder: 'stroke',
                stroke: 'rgba(0,0,0,0.15)',
                strokeWidth: 0.3,
              }}
            >
              {p.name}
            </text>
          ))}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-lg border bg-popover px-3 py-1.5 text-sm shadow-md">
          <span className="font-medium text-popover-foreground">{hovered}</span>{' '}
          <span className="text-muted-foreground">{formatCurrency(valueByProvince.get(hovered) ?? 0)}</span>
        </div>
      )}
    </div>
  )
}
