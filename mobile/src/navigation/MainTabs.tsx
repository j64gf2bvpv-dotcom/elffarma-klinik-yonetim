import * as React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Radio, Users, Activity, LayoutDashboard, MoreHorizontal } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { LiveStack } from './LiveStack'
import { CustomersStack } from './CustomersStack'
import { ActivitiesStack } from './ActivitiesStack'
import { DashboardStack } from './DashboardStack'
import { MoreStack } from './MoreStack'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * gocust'un Live/Customers/Activities/Dashboard/More alt navigasyonuna
 * birebir uyarlanmış 5 sekme. "Canlı" (Live) o an sahada olan/bugünkü
 * ziyaret ve aktivite akışını gösterir; "Panel" (Dashboard) hedef/istatistik
 * özetini gösterir — ikisi ayrı ekranlar, içerik tekrarı yok.
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
        name="LiveTab"
        component={LiveStack}
        options={{ title: 'Canlı', tabBarIcon: ({ color, size }) => <Radio color={color} size={size} /> }}
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
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: 'Panel', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Diğer', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
