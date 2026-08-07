import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen'
import type { DashboardStackParamList } from './types'

const Stack = createNativeStackNavigator<DashboardStackParamList>()

export function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  )
}
