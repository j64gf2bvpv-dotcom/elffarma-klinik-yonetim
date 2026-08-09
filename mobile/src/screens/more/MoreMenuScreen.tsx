import * as React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import {
  UserRound,
  Stethoscope,
  CalendarDays,
  BellRing,
  Handshake,
  Sparkles,
  SlidersHorizontal,
  ScanLine,
  MapPin,
  TrendingUp,
  CheckSquare,
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

// gocust'un CRM özellik kapsamına indirgenmiş "Diğer" menüsü — stok/cari/
// muhasebe/kongre gibi gocust'ta karşılığı olmayan modüller kaldırıldı.
const items: MenuItem[] = [
  { key: 'Müşteriler', label: 'Müşteriler', icon: UserRound },
  { key: 'Doktor Ziyaretleri', label: 'Doktor Ziyaretleri', icon: Stethoscope },
  { key: 'Ajanda', label: 'Ajanda', icon: CalendarDays },
  { key: 'Hatırlatmalar', label: 'Hatırlatmalar', icon: BellRing },
  { key: 'CRM', label: 'CRM', icon: Handshake },
  { key: 'Kartvizit Tara', label: 'Kartvizit Tara', icon: ScanLine },
  { key: 'Harita', label: 'Harita', icon: MapPin },
  { key: 'AI Analiz', label: 'Yapay Zeka Analiz', icon: Sparkles },
  { key: 'Ayarlar', label: 'Ayarlar', icon: SlidersHorizontal, adminOnly: true },
  { key: 'Fırsat Yönetimi', label: 'Fırsat Yönetimi', icon: TrendingUp },
  { key: 'Görevler', label: 'Görevler', icon: CheckSquare },
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
                'Müşteriler': 'Customers',
                'Doktor Ziyaretleri': 'DoctorVisits',
                'Ajanda': 'Agenda',
                'Hatırlatmalar': 'Reminders',
                'CRM': 'CrmActivities',
                'Kartvizit Tara': 'BusinessCardScan',
                'Harita': 'Map',
                'AI Analiz': 'AIAnalysis',
                'Ayarlar': 'Settings',
                'Fırsat Yönetimi': 'Opportunities',
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
