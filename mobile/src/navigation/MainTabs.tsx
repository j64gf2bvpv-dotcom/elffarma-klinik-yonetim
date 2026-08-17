import * as React from 'react'
import { View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Gauge, Users, Package, Boxes, MoreHorizontal, Plus, Map as MapIcon, Activity } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { DoctorsStack } from './DoctorsStack'
import { OrdersStack } from './OrdersStack'
import { StockStack } from './StockStack'
import { MapStack } from './MapStack'
import { ActivitiesStack } from './ActivitiesStack'
import { MoreStack } from './MoreStack'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { navigationRef } from './navigationRef'
import type { MainTabParamList } from './types'
import type { Customer } from '@shared/types/database'

const Tab = createBottomTabNavigator<MainTabParamList>()

/** "+" sekmesi hiçbir zaman gerçekten açılmıyor — tabPress'te preventDefault
 * yapılıp müşteri seçim penceresi gösteriliyor, bu yüzden boş bir bileşen
 * yeterli (bkz. MainTabs'taki listeners). */
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
  const [pickerOpen, setPickerOpen] = React.useState(false)

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.mutedForeground,
          tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
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
              setPickerOpen(true)
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
          options={{ title: 'Stok', tabBarIcon: ({ color, size }) => <Boxes color={color} size={size} /> }}
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

      <CustomerPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(customer: Customer) => {
          setPickerOpen(false)
          // RootNavigator'ın kendi navigationRef'i (deep-link handler'ın da
          // kullandığı) — Main > DoktorlarTab > CreateOrder'a iç içe geçmiş
          // parametrelerle gitmek için tip çıkarımı zorlanıyor, bu yüzden
          // burada gevşetiliyor (aşağıdaki rota adı/parametreler
          // DoctorsStackParamList ile birebir eşleşiyor, elle doğrulandı).
          if (navigationRef.isReady()) {
            navigationRef.navigate('Main', {
              screen: 'DoktorlarTab',
              params: { screen: 'CreateOrder', params: { customerId: customer.id, customerName: customer.full_name } },
            } as never)
          }
        }}
      />
    </>
  )
}
