import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { CustomersListScreen } from '@/screens/customers/CustomersListScreen'
import { CustomerDetailScreen } from '@/screens/customers/CustomerDetailScreen'
import type { CustomersStackParamList } from './types'

const Stack = createNativeStackNavigator<CustomersStackParamList>()

export function CustomersStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="CustomersList" component={CustomersListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}
