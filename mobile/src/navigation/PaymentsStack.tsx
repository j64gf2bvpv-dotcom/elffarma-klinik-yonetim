import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { PaymentsListScreen } from '@/screens/payments/PaymentsListScreen'
import { RecordPaymentScreen } from '@/screens/payments/RecordPaymentScreen'
import type { PaymentsStackParamList } from './types'

const Stack = createNativeStackNavigator<PaymentsStackParamList>()

export function PaymentsStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="PaymentsList" component={PaymentsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} options={{ title: 'Tahsilat Ekle' }} />
    </Stack.Navigator>
  )
}
