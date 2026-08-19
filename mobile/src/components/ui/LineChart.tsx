import * as React from 'react'
import { View, Text } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Path, Line, Text as SvgText } from 'react-native-svg'
import { useTheme } from '@/lib/ThemeContext'

const VIEWBOX_W = 320
const VIEWBOX_H = 140
const PAD_LEFT = 34
const PAD_BOTTOM = 18
const PAD_TOP = 8

function niceMax(n: number) {
  if (n <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(n))
  const normalized = n / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

function compactNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(Math.round(n))
}

/**
 * Bağımlılık eklemeden (victory-native vb. kurulu değil) zaten mevcut
 * react-native-svg ile çizilen basit çizgi/alan grafiği — "Performans"
 * mockup'ındaki "Günlük Ciro" grafiği için (kullanıcı isteğiyle,
 * 2026-08-20). Sabit bir viewBox koordinat sistemi kullanıp width="100%"
 * ile ölçekleniyor, onLayout ölçümüne gerek kalmıyor.
 */
export function LineChart({
  points,
  height = 160,
}: {
  points: { label: string; value: number }[]
  height?: number
}) {
  const theme = useTheme()
  const color = theme.colors.primary

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Veri yok</Text>
      </View>
    )
  }

  const maxValue = niceMax(Math.max(...points.map((p) => p.value), 0))
  const plotW = VIEWBOX_W - PAD_LEFT
  const plotH = VIEWBOX_H - PAD_TOP - PAD_BOTTOM
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0

  const coords = points.map((p, i) => ({
    x: PAD_LEFT + i * stepX,
    y: PAD_TOP + plotH - (maxValue > 0 ? (p.value / maxValue) * plotH : 0),
  }))

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`

  const yTicks = [0, 0.5, 1].map((f) => maxValue * f)
  // X ekseninde mockup'taki gibi ~5 etiket (aşırı kalabalık olmasın)
  const labelEvery = Math.max(1, Math.ceil(points.length / 5))

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {yTicks.map((t, i) => {
          const y = PAD_TOP + plotH - (maxValue > 0 ? (t / maxValue) * plotH : 0)
          return (
            <React.Fragment key={i}>
              <Line x1={PAD_LEFT} y1={y} x2={VIEWBOX_W} y2={y} stroke={theme.colors.border} strokeWidth={0.5} />
              <SvgText x={PAD_LEFT - 4} y={y + 3} fontSize={8} fill={theme.colors.mutedForeground} textAnchor="end">
                {compactNumber(t)}
              </SvgText>
            </React.Fragment>
          )
        })}

        <Path d={areaPath} fill="url(#areaFill)" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <SvgText
              key={i}
              x={coords[i].x}
              y={VIEWBOX_H - 2}
              fontSize={7.5}
              fill={theme.colors.mutedForeground}
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  )
}
