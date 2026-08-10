import * as React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Gauge, Stethoscope, Map as MapIcon, Activity, MoreHorizontal } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { DashboardStack } from './DashboardStack'
import { DoctorsStack } from './DoctorsStack'
import { MapStack } from './MapStack'
import { ActivitiesStack } from './ActivitiesStack'
import { MoreStack } from './MoreStack'
import type { MainTabParamList } from './types'

const Tab = createBottomTabNavigator<MainTabParamList>()

/** Master talimat §6'daki alt navigasyon: Ana Sayfa/Doktorlar/Harita/Aktiviteler/Daha Fazla. */
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
        name="AnaSayfaTab"
        component={DashboardStack}
        options={{ title: 'Ana Sayfa', tabBarIcon: ({ color, size }) => <Gauge color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DoktorlarTab"
        component={DoctorsStack}
        options={{ title: 'Doktorlar', tabBarIcon: ({ color, size }) => <Stethoscope color={color} size={size} /> }}
      />
      <Tab.Screen
        name="HaritaTab"
        component={MapStack}
        options={{ title: 'Harita', tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} /> }}
      />
      <Tab.Screen
        name="AktivitelerTab"
        component={ActivitiesStack}
        options={{ title: 'Aktiviteler', tabBarIcon: ({ color, size }) => <Activity color={color} size={size} /> }}
      />
      <Tab.Screen
        name="DigerTab"
        component={MoreStack}
        options={{ title: 'Daha Fazla', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  )
}
