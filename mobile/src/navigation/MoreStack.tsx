import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '@/lib/ThemeContext'
import { MoreMenuScreen } from '@/screens/more/MoreMenuScreen'
import { ComingSoonScreen } from '@/screens/ComingSoonScreen'
import { BusinessCardScanScreen } from '@/screens/crm/BusinessCardScanScreen'
import { DoctorVisitsScreen } from '@/screens/more/DoctorVisitsScreen'
import { AgendaScreen } from '@/screens/more/AgendaScreen'
import { RemindersScreen } from '@/screens/more/RemindersScreen'
import { AIAnalysisScreen } from '@/screens/more/AIAnalysisScreen'
import { SettingsScreen } from '@/screens/more/SettingsScreen'
import { OpportunitiesScreen } from '@/screens/more/OpportunitiesScreen'
import { TasksScreen } from '@/screens/more/TasksScreen'
import { QuotesScreen } from '@/screens/more/QuotesScreen'
import { CongressesScreen } from '@/screens/more/CongressesScreen'
import { CongressDetailScreen } from '@/screens/more/CongressDetailScreen'
import { TargetsScreen } from '@/screens/more/TargetsScreen'
import { AuditLogsScreen } from '@/screens/more/AuditLogsScreen'
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
      <Stack.Screen name="BusinessCardScan" component={BusinessCardScanScreen} options={{ title: 'Kartvizit Tara' }} />
      <Stack.Screen name="DoctorVisits" component={DoctorVisitsScreen} options={{ title: 'Doktor Ziyaretleri' }} />
      <Stack.Screen name="Agenda" component={AgendaScreen} options={{ title: 'Ajanda' }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: 'Hatırlatmalar' }} />
      <Stack.Screen name="AIAnalysis" component={AIAnalysisScreen} options={{ title: 'Yapay Zeka Analiz' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
      <Stack.Screen name="Opportunities" component={OpportunitiesScreen} options={{ title: 'Fırsat Yönetimi' }} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Görevler' }} />
      <Stack.Screen name="Quotes" component={QuotesScreen} options={{ title: 'Teklifler' }} />
      <Stack.Screen name="Congresses" component={CongressesScreen} options={{ title: 'Kongreler' }} />
      <Stack.Screen name="CongressDetail" component={CongressDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="Targets" component={TargetsScreen} options={{ title: 'Hedeflerim' }} />
      <Stack.Screen name="AuditLogs" component={AuditLogsScreen} options={{ title: 'Audit Log' }} />
      <Stack.Screen
        name="ComingSoon"
        component={ComingSoonScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  )
}
