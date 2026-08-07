import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { CariHesapListScreen } from '@/screens/cariHesap/CariHesapListScreen'
import { CariHesapDetailScreen } from '@/screens/cariHesap/CariHesapDetailScreen'
import type { CariHesapStackParamList } from './types'

const Stack = createNativeStackNavigator<CariHesapStackParamList>()

export function CariHesapStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="CariHesapList" component={CariHesapListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CariHesapDetail" component={CariHesapDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  )
}
