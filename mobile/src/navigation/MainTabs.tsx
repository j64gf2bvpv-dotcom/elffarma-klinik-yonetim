import * as React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Gauge, PackageSearch, Receipt, Banknote, MoreHorizontal } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { StockStack } from './StockStack'
import { CariHesapStack } from './CariHesapStack'
import { PaymentsStack } from './PaymentsStack'
import { MoreStack } from './MoreStack'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * Masaüstündeki AppShell sidebar'ının mobil karşılığı — plan §Navigation'da
 * kararlaştırılan 5 sekme (Anasayfa/Stok/Cari Hesap/Tahsilatlar/Diğer).
 * Müşteriler bilinçli olarak sekme değil, "Diğer" içinde (bkz. plan).
 */
export function MainTabs() {
  const theme = useTheme()
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
      }}
    >
      <Tab.Screen
        name="AnasayfaTab"
        component={DashboardStack}
        options={{ title: 'Anasayfa', tabBarIcon: ({ color, size }) => <Gauge color={color} size={size} /> }}
      />
      <Tab.Screen
        name="StokTab"
        component={StockStack}
        options={{ title: 'Stok', tabBarIcon: ({ color, size }) => <PackageSearch color={color} size={size} /> }}
      />
      <Tab.Screen
        name="CariHesapTab"
        component={CariHesapStack}
        options={{ title: 'Cari Hesap', tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
      />
      <Tab.Screen
        name="TahsilatlarTab"
        component={PaymentsStack}
        options={{ title: 'Tahsilatlar', tabBarIcon: ({ color, size }) => <Banknote color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Diğer', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
