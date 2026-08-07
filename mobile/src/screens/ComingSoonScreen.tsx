import * as React from 'react'
import { Text, View } from 'react-native'
import { Clock } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { useTheme } from '@/lib/ThemeContext'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'ComingSoon'>

/** Masaüstündeki ComingSoonPage'in mobil karşılığı — henüz Faz 1'de
 * kurulmamış "Diğer" menü öğeleri için (bkz. plan §Phase 1: nav şekli
 * baştan sabit, ekranlar fazlar ilerledikçe dolduruluyor). */
export function ComingSoonScreen({ route }: Props) {
  const { title } = route.params
  const theme = useTheme()
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Clock color={theme.colors.mutedForeground} size={40} />
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '600' }}>
          {title}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
          Bu bölüm yakında mobilde de kullanıma açılacak.
        </Text>
      </View>
    </Screen>
  )
}
