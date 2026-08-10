import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { MapScreen } from '@/screens/map/MapScreen'
import type { MapStackParamList } from './types'

const Stack = createNativeStackNavigator<MapStackParamList>()

export function MapStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={MapScreen} />
    </Stack.Navigator>
  )
}
