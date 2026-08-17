import * as React from 'react'
import { Text, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gauge, Users, Package, Boxes, MoreHorizontal, Plus, Map as MapIcon, Activity } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { DoctorsStack } from './DoctorsStack'
import { OrdersStack } from './OrdersStack'
import { StockStack } from './StockStack'
import { MapStack } from './MapStack'
import { ActivitiesStack } from './ActivitiesStack'
import { MoreStack } from './MoreStack'
import { navigationRef } from './navigationRef'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/** "+" sekmesi hiçbir zaman gerçekten açılmıyor — tabPress'te preventDefault
 * yapılıp doğrudan Yeni Sipariş sihirbazına gidiliyor, bu yüzden boş bir
 * bileşen yeterli (bkz. MainTabs'taki listeners). */
function NoopScreen() {
  return <View style={{ flex: 1 }} />
}

/**
 * Kullanıcının paylaştığı "Elffarma Satış Programı" pazarlama görselindeki
 * sekme yapısı: Ana Sayfa / Müşteriler / + (Yeni Sipariş) / Siparişler /
 * Daha Fazla — satış ekibinin günlük kullanacağı SADECE bu 4 gerçek sekme
 * (kullanıcı isteği, 2026-08-16). Harita ve Aktiviteler önceden ayrı
 * sekmelerdi; silinmedi ama sekme çubuğundan kaldırılıp Daha Fazla menüsüne
 * taşındı (bkz. MoreMenuScreen) — buradaki iki Tab.Screen hâlâ kayıtlı
 * (tabBarButton: null) ki Daha Fazla'dan navigation.getParent().navigate(...)
 * ile erişilebilsin, ayrı bir stack dosyası taşımaya gerek kalmadı.
 */
export function MainTabs() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        // Kullanıcı isteğiyle (2026-08-17) — önceki denemede etiket 2 satıra
        // sarılıyordu ama sekme kutusunun yüksekliği artırılmamıştı, bu
        // yüzden ikinci satır çubuğun dışına taşıp gerçek cihazda
        // okunamıyordu. Şimdi çubuğun kendi yüksekliği (+ alt safe-area) 2
        // satırlık etiketi rahatça içine alacak şekilde büyütüldü, TÜM
        // sekmeler aynı (ortalı, taşmayan) etiket bileşenini kullanıyor.
        // Kullanıcı isteğiyle (2026-08-17) — çubuk sola yaslanmış görünüyordu.
        // flexDirection/justifyContent'i (ve her sekmeye flex:1) elle
        // belirtmek, kütüphanenin varsayılan eşit-dağıtım davranışına
        // güvenmek yerine, çubuğun tamamını kapladığından ve her sekmenin
        // eşit genişlikte + ortalı olduğundan emin oluyor.
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
          flexDirection: 'row',
          width: '100%',
        },
        tabBarItemStyle: { flex: 1, paddingHorizontal: 0, alignItems: 'center', justifyContent: 'center' },
        tabBarLabel: ({ color, children }) => (
          <Text style={{ color, fontSize: 9.5, textAlign: 'center', lineHeight: 12, marginTop: 1 }} numberOfLines={2}>
            {children}
          </Text>
        ),
      }}
    >
      <Tab.Screen
        name="AnaSayfaTab"
        component={DashboardStack}
        options={{ title: 'Ana Sayfa', tabBarIcon: ({ color, size }) => <Gauge color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DoktorlarTab"
        component={DoctorsStack}
        options={{ title: 'Müşteriler', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tab.Screen
        name="YeniSiparisTab"
        component={NoopScreen}
        options={{
          title: '',
          tabBarIcon: () => (
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                marginBottom: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
                shadowColor: theme.colors.primary,
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 4,
              }}
            >
              <Plus color={theme.colors.primaryForeground} size={24} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault()
            // Kullanıcı isteğiyle (2026-08-17) — "+" artık ayrı bir müşteri
            // seçim penceresi açmadan doğrudan Yeni Sipariş sihirbazına
            // gidiyor, müşteri seçimi sihirbazın kendi 1. adımında.
            if (navigationRef.isReady()) {
              navigationRef.navigate('Main', {
                screen: 'DoktorlarTab',
                params: { screen: 'CreateOrder', params: undefined },
              } as never)
            }
          },
        }}
      />
      <Tab.Screen
        name="SiparislerTab"
        component={OrdersStack}
        options={{ title: 'Siparişler', tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }}
      />
      <Tab.Screen
        name="StokTab"
        component={StockStack}
        options={{ title: 'Ürünler ve Stok', tabBarIcon: ({ color, size }) => <Boxes color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Daha Fazla', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
      <Tab.Screen
        name="HaritaTab"
        component={MapStack}
        options={{ tabBarButton: () => null, tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="AktivitelerTab"
        component={ActivitiesStack}
        options={{ tabBarButton: () => null, tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
