import * as React from 'react'
import { Text, View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { useTheme } from '@/lib/ThemeContext'

/**
 * react-native-maps native-only bir modül — web platformunda çalışmıyor
 * (codegenNativeComponent hatasıyla tüm bundle'ı çökertir). Bu web-only
 * varyant, gerçek MapScreen (MapScreen.tsx) yerine sadece web derlemesinde
 * kullanılır; iOS/Android'de harita normal şekilde çalışmaya devam eder.
 */
export function MapScreen() {
  const theme = useTheme()
  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Harita" subtitle="Sadece mobil cihazlarda" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <MapPin size={40} color={theme.colors.mutedForeground} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', textAlign: 'center' }}>
          Harita görünümü web'de desteklenmiyor
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
          Bu özellik iOS ve Android uygulamasında kullanılabilir.
        </Text>
      </View>
    </Screen>
  )
}
