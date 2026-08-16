import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { OrdersScreen } from '@/screens/orders/OrdersScreen'
import type { OrdersStackParamList } from './types'

const Stack = createNativeStackNavigator<OrdersStackParamList>()

export function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} />
    </Stack.Navigator>
  )
}
