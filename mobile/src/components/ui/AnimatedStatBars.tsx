import * as React from 'react'
import { Animated, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { Card } from './Card'

export interface StatBarItem {
  icon: LucideIcon
  label: string
  value: string
  color?: string
}

/**
 * Ana Sayfa'daki Toplam Cari/Ürün Çeşidi/Bugünkü İşlemler kartlarının
 * "çubuk şeklinde animasyonlu grafik" isteği — üç metrik farklı birimde
 * (para/adet/adet) olduğu için ortak bir eksende karşılaştırmak yanıltıcı
 * olur; bunun yerine her satır kendi çubuğunu ekrana girişte 0'dan tam
 * genişliğe animasyonla dolduruyor (kademeli gecikmeyle), sayı uydurmadan
 * salt görsel bir "grafik" hissi veriyor.
 */
export function AnimatedStatBars({ items }: { items: StatBarItem[] }) {
  const theme = useTheme()
  return (
    <Card style={{ gap: 14 }}>
      {items.map((item, i) => (
        <StatBarRow key={item.label} item={item} delay={i * 120} defaultColor={theme.colors.primary} />
      ))}
    </Card>
  )
}

function StatBarRow({ item, delay, defaultColor }: { item: StatBarItem; delay: number; defaultColor: string }) {
  const theme = useTheme()
  const progress = React.useRef(new Animated.Value(0)).current
  const color = item.color ?? defaultColor

  React.useEffect(() => {
    progress.setValue(0)
    Animated.timing(progress, { toValue: 1, duration: 700, delay, useNativeDriver: false }).start()
  }, [item.value, delay, progress])

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <item.icon size={14} color={color} />
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600', flex: 1 }}>
          {item.label}
        </Text>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
          {item.value}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.muted, overflow: 'hidden' }}>
        <Animated.View style={{ width, height: '100%', borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  )
}
