import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { LiveScreen } from '@/screens/live/LiveScreen'
import type { LiveStackParamList } from './types'

const Stack = createNativeStackNavigator<LiveStackParamList>()

export function LiveStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Live" component={LiveScreen} />
    </Stack.Navigator>
  )
}
