import * as React from 'react'
import { Text, View } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'

/** Liste ekranlarının başlık satırı — Dashboard'daki başlık ritmiyle
 * (kalın başlık + sağda ikon/aksiyon grubu) tutarlı tek bir yer. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700' }}>{title}</Text>
        {subtitle && (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 1 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {actions && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{actions}</View>}
    </View>
  )
}
