import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { DoctorsListScreen } from '@/screens/doctors/DoctorsListScreen'
import { DoctorDetailScreen } from '@/screens/doctors/DoctorDetailScreen'
import { VisitFlowScreen } from '@/screens/doctors/VisitFlowScreen'
import { CreateOrderScreen } from '@/screens/doctors/CreateOrderScreen'
import { CreateQuoteScreen } from '@/screens/doctors/CreateQuoteScreen'
import type { DoctorsStackParamList } from './types'

const Stack = createNativeStackNavigator<DoctorsStackParamList>()

export function DoctorsStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
      }}
    >
      <Stack.Screen name="DoctorsList" component={DoctorsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DoctorDetail" component={DoctorDetailScreen} options={{ title: '' }} />
      {/* VisitFlow/CreateOrder/CreateQuote kendi ScreenHeader'ını (geri oku
          dahil) gösteriyor — native header kapalı, çift başlık olmasın diye. */}
      <Stack.Screen name="VisitFlow" component={VisitFlowScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateQuote" component={CreateQuoteScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}
