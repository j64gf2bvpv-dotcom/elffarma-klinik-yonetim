import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '@/lib/ThemeContext'

/**
 * Liste ekranlarının başlık satırı — Dashboard'daki başlık ritmiyle (kalın
 * başlık + sağda ikon/aksiyon grubu) tutarlı tek bir yer. Alt (detay)
 * ekranların native-stack header'ı bu bileşenle çakışmaması için
 * `headerShown: false` yapıldığından (bkz. MoreStack.tsx/DoctorsStack.tsx),
 * geri gidilebilecek bir ekransa (`canGoBack()`) burada kendi geri okunu
 * gösteriyor — sekme köklerinde (Dashboard, Doktorlar listesi, Harita vb.)
 * `canGoBack()` false döndüğü için ok görünmüyor.
 */
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
  const navigation = useNavigation()
  const canGoBack = navigation.canGoBack()

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
      {canGoBack && (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [
            {
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <ChevronLeft size={18} color={theme.colors.foreground} />
        </Pressable>
      )}
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
