import * as React from 'react'
import { Text, View } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'

/** `showPercentage` verilirse çubuk yeterince kalınlaşıp yüzdeyi kendi
 * içinde ortalanmış olarak gösterir (ör. Ana Panel "Hedeflerim" kartı) —
 * varsayılan (ince) çubuk diğer kullanım yerlerinde (Hedeflerim ekranı,
 * doktor detayı) değişmeden kalıyor. */
export function ProgressBar({ ratio, color, showPercentage }: { ratio: number; color?: string; showPercentage?: boolean }) {
  const theme = useTheme()
  const pct = Math.max(0, Math.min(1, ratio))
  const barColor = color ?? theme.colors.primary

  if (showPercentage) {
    return (
      <View
        style={{
          height: 22,
          borderRadius: 11,
          backgroundColor: theme.colors.muted,
          overflow: 'hidden',
          justifyContent: 'center',
        }}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: 11, backgroundColor: barColor }} />
        <Text
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: '700',
            color: theme.colors.foreground,
          }}
        >
          {`%${Math.round(pct * 100)}`}
        </Text>
      </View>
    )
  }

  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.muted, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: barColor }} />
    </View>
  )
}
