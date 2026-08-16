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
  Presentation,
  Target,
  Boxes,
  CalendarRange,
  Send,
  MessageSquare,
  Map as MapIcon,
  Activity,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import type { MoreStackParamList, MainTabParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>

interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

// Ana sekme çubuğu artık pazarlama görselindeki 4 gerçek sekmeye
// (Ana Sayfa/Müşteriler/+/Siparişler) indirildiği için Harita ve
// Aktiviteler de (önceden kendi sekmeleriydi) buraya taşındı — kod/özellik
// silinmedi, sadece giriş noktası değişti (kullanıcı isteği, 2026-08-16).
const items: MenuItem[] = [
  { key: 'Hedeflerim', label: 'Hedeflerim', icon: Target },
  { key: 'Bildirimler', label: 'Bildirimler', icon: BellRing },
  { key: 'Stok', label: 'Stok', icon: Boxes },
  { key: 'Fırsat Yönetimi', label: 'Fırsatlar', icon: TrendingUp },
  { key: 'Teklifler', label: 'Teklifler', icon: FileText },
  { key: 'Kongreler', label: 'Kongreler', icon: Presentation },
  { key: 'Görevler', label: 'Görevler', icon: CheckSquare },
  { key: 'Doktor Ziyaretleri', label: 'Ziyaret Geçmişi', icon: Stethoscope },
  { key: 'Harita', label: 'Harita', icon: MapIcon },
  { key: 'Aktiviteler', label: 'Aktiviteler', icon: Activity },
  { key: 'Haftalık Rapor', label: 'Haftalık Rapor', icon: CalendarRange },
  { key: 'Haftalık Plan', label: 'Haftalık Plan', icon: Send },
  { key: 'Ekip Sohbeti', label: 'Ekip Sohbeti', icon: MessageSquare },
  { key: 'Ajanda', label: 'Ajanda', icon: CalendarDays },
  { key: 'Kartvizit Tara', label: 'Kartvizit Tara', icon: ScanLine },
  { key: 'AI Analiz', label: 'Yapay Zeka Analiz', icon: Sparkles },
  { key: 'Ayarlar', label: 'Ayarlar', icon: SlidersHorizontal, adminOnly: true },
]

// Bu ikisi artık ana sekme çubuğunda değil (kendi bağımsız Tab.Screen'leri
// hâlâ kayıtlı, sadece tabBarButton gizli — bkz. MainTabs.tsx), bu yüzden
// MoreStack'in İÇİNDEKİ bir rota değil, üst (tab) navigator'a geçilmesi
// gerekiyor: navigation.getParent().
const PARENT_TAB_ROUTES: Record<string, keyof MainTabParamList> = {
  Harita: 'HaritaTab',
  Aktiviteler: 'AktivitelerTab',
}

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
              const parentTab = PARENT_TAB_ROUTES[item.key]
              if (parentTab) return navigation.getParent()?.navigate(parentTab as never)

              const routeMap: Record<string, string> = {
                'Doktor Ziyaretleri': 'DoctorVisits',
                'Haftalık Rapor': 'WeeklyReport',
                'Haftalık Plan': 'WeeklyPlan',
                'Ekip Sohbeti': 'TeamChat',
                'Ajanda': 'Agenda',
                'Bildirimler': 'Reminders',
                'Kartvizit Tara': 'BusinessCardScan',
                'AI Analiz': 'AIAnalysis',
                'Ayarlar': 'Settings',
                'Hedeflerim': 'Targets',
                'Stok': 'Stock',
                'Fırsat Yönetimi': 'Opportunities',
                'Teklifler': 'Quotes',
                'Kongreler': 'Congresses',
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
