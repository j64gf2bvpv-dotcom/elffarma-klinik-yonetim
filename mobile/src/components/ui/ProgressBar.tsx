import * as React from 'react'
import { View } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'

export function ProgressBar({ ratio, color }: { ratio: number; color?: string }) {
  const theme = useTheme()
  const pct = Math.max(0, Math.min(1, ratio))
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.muted, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color ?? theme.colors.primary }} />
    </View>
  )
}
