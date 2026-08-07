import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { MoreMenuScreen } from '@/screens/more/MoreMenuScreen'
import { ComingSoonScreen } from '@/screens/ComingSoonScreen'
import type { MoreStackParamList } from './types'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export function MoreStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ComingSoon"
        component={ComingSoonScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  )
}
