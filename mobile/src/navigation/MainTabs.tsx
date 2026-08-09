import * as React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Gauge, Receipt, MoreHorizontal } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { CariHesapStack } from './CariHesapStack'
import { MoreStack } from './MoreStack'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * gocust'un CRM özellik kapsamına indirgenmiş alt navigasyon — 3 sekme
 * (Anasayfa/Cari Hesap/Diğer). Stok ve Tahsilatlar gocust'un CRM
 * kapsamında olmadığı için kaldırıldı.
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
        name="CariHesapTab"
        component={CariHesapStack}
        options={{ title: 'Cari Hesap', tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Diğer', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
