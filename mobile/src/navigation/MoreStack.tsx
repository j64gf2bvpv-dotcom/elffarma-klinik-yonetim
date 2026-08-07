import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { MoreMenuScreen } from '@/screens/more/MoreMenuScreen'
import { ComingSoonScreen } from '@/screens/ComingSoonScreen'
import { CrmActivitiesScreen } from '@/screens/crm/CrmActivitiesScreen'
import { BusinessCardScanScreen } from '@/screens/crm/BusinessCardScanScreen'
import { MapScreen } from '@/screens/crm/MapScreen'
import { CustomersScreen } from '@/screens/more/CustomersScreen'
import { SalesScreen } from '@/screens/more/SalesScreen'
import { DoctorVisitsScreen } from '@/screens/more/DoctorVisitsScreen'
import { AgendaScreen } from '@/screens/more/AgendaScreen'
import { RemindersScreen } from '@/screens/more/RemindersScreen'
import { CongressesScreen } from '@/screens/more/CongressesScreen'
import { PrimScreen } from '@/screens/more/PrimScreen'
import { ExpensesScreen } from '@/screens/more/ExpensesScreen'
import { BudgetScreen } from '@/screens/more/BudgetScreen'
import { AIAnalysisScreen } from '@/screens/more/AIAnalysisScreen'
import { InstagramLeadsScreen } from '@/screens/more/InstagramLeadsScreen'
import { VehiclesScreen } from '@/screens/more/VehiclesScreen'
import { SettingsScreen } from '@/screens/more/SettingsScreen'
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
      <Stack.Screen name="CrmActivities" component={CrmActivitiesScreen} options={{ title: 'Aktiviteler' }} />
      <Stack.Screen name="BusinessCardScan" component={BusinessCardScanScreen} options={{ title: 'Kartvizit Tara' }} />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Harita' }} />
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Müşteriler' }} />
      <Stack.Screen name="Sales" component={SalesScreen} options={{ title: 'Satışlar' }} />
      <Stack.Screen name="DoctorVisits" component={DoctorVisitsScreen} options={{ title: 'Doktor Ziyaretleri' }} />
      <Stack.Screen name="Agenda" component={AgendaScreen} options={{ title: 'Ajanda' }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: 'Hatırlatmalar' }} />
      <Stack.Screen name="Congresses" component={CongressesScreen} options={{ title: 'Kongreler' }} />
      <Stack.Screen name="Prim" component={PrimScreen} options={{ title: 'Prim' }} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Giderler' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Bütçe Yılı' }} />
      <Stack.Screen name="AIAnalysis" component={AIAnalysisScreen} options={{ title: 'Yapay Zeka Analiz' }} />
      <Stack.Screen name="InstagramLeads" component={InstagramLeadsScreen} options={{ title: 'Instagram Doktor Listesi' }} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} options={{ title: 'Araçlar' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
      <Stack.Screen
        name="ComingSoon"
        component={ComingSoonScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  )
}
