import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { StockListScreen } from '@/screens/stock/StockListScreen'
import { RecordMovementScreen } from '@/screens/stock/RecordMovementScreen'
import type { StockStackParamList } from './types'

const Stack = createNativeStackNavigator<StockStackParamList>()

export function StockStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="StockList" component={StockListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RecordMovement" component={RecordMovementScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}
