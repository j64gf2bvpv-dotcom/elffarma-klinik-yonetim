import * as React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Gauge, Users, Activity, MoreHorizontal } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { CustomersStack } from './CustomersStack'
import { ActivitiesStack } from './ActivitiesStack'
import { MoreStack } from './MoreStack'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * gocust'un Live/Customers/Activities/Dashboard/More alt navigasyonundan
 * ilham alınmış 4 sekme (Anasayfa/Müşteriler/Aktiviteler/Diğer) — "Live" ve
 * "Dashboard" ayrımı bizde yok, ikisi zaten tek gerçek-veri Anasayfa
 * ekranında birleşik olduğu için uydurma bir 5. sekme eklenmedi.
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
        name="CustomersTab"
        component={CustomersStack}
        options={{ title: 'Müşteriler', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ActivitiesTab"
        component={ActivitiesStack}
        options={{ title: 'Aktiviteler', tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Diğer', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
