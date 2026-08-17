import * as React from 'react'
import { Alert, Text, View } from 'react-native'
import { type LucideIcon } from 'lucide-react-native'
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
  UserRound,
  LifeBuoy,
  LogOut,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useAppSetting } from '@/features/appSettings/hooks'
import type { MoreStackParamList, MainTabParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>

export interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const MORE_MENU_ORDER_SETTING_KEY = 'mobile_more_menu_order'

// Pazarlama görselindeki "Daha Fazla" listesiyle aynı sırada (kullanıcı
// isteği, 2026-08-16: "menüler tam istediğim gibi olmalı, sıralamalar tam
// istediğim gibi"). "Dökümanlar" görselde vardı ama uygulamada global bir
// "tüm belgelerim" ekranının karşılığı yok (attachments API'si sadece
// tek bir kayda bağlı belgeleri destekliyor, ör. bir doktorun dosyaları) —
// bu yüzden eklenmedi, gerçek bir özellik istenirse ayrı ele alınmalı.
// 'Profil Bilgileri' ve 'Ayarlar' her zaman sabit — admin bu ikisini
// gizleyip kendini kilitleyemesin diye yönetilebilir listeye dahil değil.
const primaryItems: MenuItem[] = [{ key: 'Profil Bilgileri', label: 'Profil Bilgileri', icon: UserRound }]
const settingsItem: MenuItem = { key: 'Ayarlar', label: 'Ayarlar', icon: SlidersHorizontal, adminOnly: true }

const managedPrimaryItems: MenuItem[] = [
  { key: 'Hedeflerim', label: 'Hedeflerim', icon: Target },
  { key: 'Bildirimler', label: 'Bildirimler', icon: BellRing },
  { key: 'Destek', label: 'Destek', icon: LifeBuoy },
]

// Ana sekme çubuğu artık pazarlama görselindeki 4 gerçek sekmeye
// (Ana Sayfa/Müşteriler/+/Siparişler) indirildiği için Harita ve
// Aktiviteler de (önceden kendi sekmeleriydi) buraya taşındı — kod/özellik
// silinmedi, sadece giriş noktası değişti. Bunlar görselde birebir yok ama
// uygulamanın var olan diğer modülleri — "Diğer Modüller" başlığı altında.
const secondaryItems: MenuItem[] = [
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
]

/** Admin'in personel bazında gizleyebildiği / sırasını değiştirebildiği
 * tüm paneller — bkz. PanelManagementCard.tsx (Ayarlar > Panel Yönetimi). */
export const MANAGEABLE_ITEMS: MenuItem[] = [...managedPrimaryItems, ...secondaryItems]

// Bu ikisi artık ana sekme çubuğunda değil (kendi bağımsız Tab.Screen'leri
// hâlâ kayıtlı, sadece tabBarButton gizli — bkz. MainTabs.tsx), bu yüzden
// MoreStack'in İÇİNDEKİ bir rota değil, üst (tab) navigator'a geçilmesi
// gerekiyor: navigation.getParent().
const PARENT_TAB_ROUTES: Record<string, keyof MainTabParamList> = {
  Harita: 'HaritaTab',
  Aktiviteler: 'AktivitelerTab',
}

const ROUTE_MAP: Record<string, string> = {
  'Profil Bilgileri': 'Profile',
  'Destek': 'Support',
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

export function MoreMenuScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff, signOut } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: savedOrder = [] } = useAppSetting<string[]>(MORE_MENU_ORDER_SETTING_KEY)

  const visibleManagedItems = React.useMemo(() => {
    const hidden = new Set(staff?.mobile_hidden_panels ?? [])
    const visible = MANAGEABLE_ITEMS.filter((item) => !hidden.has(item.key))
    if (!savedOrder || savedOrder.length === 0) return visible
    return [...visible].sort((a, b) => {
      const ia = savedOrder.indexOf(a.key)
      const ib = savedOrder.indexOf(b.key)
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
    })
  }, [staff?.mobile_hidden_panels, savedOrder])

  function handlePress(item: MenuItem) {
    const parentTab = PARENT_TAB_ROUTES[item.key]
    if (parentTab) return navigation.getParent()?.navigate(parentTab as never)
    const route = ROUTE_MAP[item.key]
    if (route) return navigation.navigate(route as never)
  }

  function confirmSignOut() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => signOut() },
    ])
  }

  return (
    <Screen scroll style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.primary + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserRound size={26} color={theme.colors.primary} />
        </View>
        <View>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>
            {staff?.full_name ?? 'Kullanıcı'}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
            {staff?.job_title || (isAdmin ? 'Yönetici' : 'Satış Temsilcisi')}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {primaryItems.map((item) => (
          <ListItemCard key={item.key} icon={item.icon} title={item.label} onPress={() => handlePress(item)} />
        ))}
        {isAdmin && (
          <ListItemCard key={settingsItem.key} icon={settingsItem.icon} title={settingsItem.label} onPress={() => handlePress(settingsItem)} />
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontSize: theme.fontSizes.xs,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 2,
          }}
        >
          Diğer Modüller
        </Text>
        {visibleManagedItems.map((item) => (
          <ListItemCard key={item.key} icon={item.icon} title={item.label} onPress={() => handlePress(item)} />
        ))}
      </View>

      <ListItemCard icon={LogOut} iconColor={theme.colors.destructive} title="Çıkış Yap" onPress={confirmSignOut} />
    </Screen>
  )
}
