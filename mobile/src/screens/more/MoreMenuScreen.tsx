import * as React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { ChevronRight, type LucideIcon } from 'lucide-react-native'
import {
  UserRound,
  ShoppingCart,
  Stethoscope,
  CalendarDays,
  BellRing,
  Presentation,
  Percent,
  Handshake,
  ReceiptText,
  Target,
  Sparkles,
  AtSign,
  Car,
  SlidersHorizontal,
  ScanLine,
  MapPin,
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

// Masaüstündeki AppShell navItems'ının "Diğer" içine giren kısmı — bkz. plan
// §Navigation. Faz 1'de hepsi ComingSoonScreen'e düşüyor (Müşteriler dahil,
// çünkü CRUD'u Faz 2'de); nav şekli baştan sabit, ekranlar fazlar ilerledikçe
// dolduruluyor.
const items: MenuItem[] = [
  { key: 'Müşteriler', label: 'Müşteriler', icon: UserRound },
  { key: 'Satışlar', label: 'Satışlar', icon: ShoppingCart },
  { key: 'Doktor Ziyaretleri', label: 'Doktor Ziyaretleri', icon: Stethoscope },
  { key: 'Ajanda', label: 'Ajanda', icon: CalendarDays },
  { key: 'Hatırlatmalar', label: 'Hatırlatmalar', icon: BellRing },
  { key: 'Kongreler', label: 'Kongreler', icon: Presentation },
  { key: 'Prim', label: 'Prim', icon: Percent },
  { key: 'CRM', label: 'CRM', icon: Handshake },
  { key: 'Kartvizit Tara', label: 'Kartvizit Tara', icon: ScanLine },
  { key: 'Harita', label: 'Harita', icon: MapPin },
  { key: 'Giderler', label: 'Giderler', icon: ReceiptText },
  { key: 'Bütçe Yılı', label: 'Bütçe Yılı', icon: Target },
  { key: 'AI Analiz', label: 'Yapay Zeka Analiz', icon: Sparkles },
  { key: 'Instagram Doktor Listesi', label: 'Instagram Doktor Listesi', icon: AtSign },
  { key: 'Araçlar', label: 'Araçlar', icon: Car },
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
              if (item.key === 'CRM') return navigation.navigate('CrmActivities')
              if (item.key === 'Kartvizit Tara') return navigation.navigate('BusinessCardScan')
              if (item.key === 'Harita') return navigation.navigate('Map')
              return navigation.navigate('ComingSoon', { title: item.label })
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
