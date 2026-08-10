import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CrmActivitiesScreen } from '@/screens/crm/CrmActivitiesScreen'
import type { ActivitiesStackParamList } from './types'

const Stack = createNativeStackNavigator<ActivitiesStackParamList>()

export function ActivitiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ActivitiesList" component={CrmActivitiesScreen} />
    </Stack.Navigator>
  )
}
