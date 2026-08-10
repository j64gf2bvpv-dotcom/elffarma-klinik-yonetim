import * as React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import {
  Stethoscope,
  CalendarDays,
  BellRing,
  Sparkles,
  SlidersHorizontal,
  ScanLine,
  TrendingUp,
  CheckSquare,
  FileText,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>

interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

// Master talimat §6'daki "Daha Fazla" menüsü — Doktorlar/Harita/Aktiviteler
// artık kendi alt sekmeleri olduğu için burada değil.
const items: MenuItem[] = [
  { key: 'Fırsat Yönetimi', label: 'Fırsatlar', icon: TrendingUp },
  { key: 'Teklifler', label: 'Teklifler', icon: FileText },
  { key: 'Görevler', label: 'Görevler', icon: CheckSquare },
  { key: 'Doktor Ziyaretleri', label: 'Ziyaret Geçmişi', icon: Stethoscope },
  { key: 'Ajanda', label: 'Ajanda', icon: CalendarDays },
  { key: 'Hatırlatmalar', label: 'Hatırlatmalar', icon: BellRing },
  { key: 'Kartvizit Tara', label: 'Kartvizit Tara', icon: ScanLine },
  { key: 'AI Analiz', label: 'Yapay Zeka Analiz', icon: Sparkles },
  { key: 'Ayarlar', label: 'Ayarlar', icon: SlidersHorizontal, adminOnly: true },
]

export function MoreMenuScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin)

  return (
    <Screen>
      <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700', marginBottom: 12 }}>
        Diğer
      </Text>
      <FlatList
        data={visibleItems}
        keyExtractor={(i) => i.key}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const routeMap: Record<string, string> = {
                'Doktor Ziyaretleri': 'DoctorVisits',
                'Ajanda': 'Agenda',
                'Hatırlatmalar': 'Reminders',
                'Kartvizit Tara': 'BusinessCardScan',
                'AI Analiz': 'AIAnalysis',
                'Ayarlar': 'Settings',
                'Fırsat Yönetimi': 'Opportunities',
                'Teklifler': 'Quotes',
                'Görevler': 'Tasks',
              }
              const route = routeMap[item.key]
              if (route) return navigation.navigate(route as never)
            }}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <item.icon size={20} color={theme.colors.primary} />
            <Text style={{ flex: 1, color: theme.colors.foreground, fontWeight: '500' }}>{item.label}</Text>
            <ChevronRight size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        )}
      />
    </Screen>
  )
}
