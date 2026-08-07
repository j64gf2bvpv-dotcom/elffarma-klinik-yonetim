import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'

/**
 * Liste ekranlarındaki (Cari Hesap, Stok, Tahsilatlar) düz metin satırlarının
 * yerini alan, kart görünümlü satır bileşeni — ikon rozeti + başlık/alt
 * başlık + sağda rakam/rozet, gocust referansındaki "Today's Activities"
 * kart listesiyle aynı yerleşim dili (bkz. mobil Dashboard önizlemesi).
 */
export function ListItemCard({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: LucideIcon
  iconColor?: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  onPress?: () => void
}) {
  const theme = useTheme()
  const tint = iconColor ?? theme.colors.primary

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing(3),
        },
        pressed && { opacity: 0.65 },
      ]}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: theme.radius.sm,
          backgroundColor: tint + '26',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 0,
        }}
      >
        <Icon size={18} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.base }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {onPress && <ChevronRight size={18} color={theme.colors.mutedForeground} />}
    </Pressable>
  )
}
