import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
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
import { StockScreen } from '@/screens/more/StockScreen'
import { WeeklyReportScreen } from '@/screens/more/WeeklyReportScreen'
import { WeeklyPlanScreen } from '@/screens/more/WeeklyPlanScreen'
import { TeamChatScreen } from '@/screens/more/TeamChatScreen'
import { ProfileScreen } from '@/screens/more/ProfileScreen'
import { SupportScreen } from '@/screens/more/SupportScreen'
import type { MoreStackParamList } from './types'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export function MoreStack() {
  return (
    // Alt ekranların tamamı kendi ScreenHeader'ını (geri oku dahil, bkz.
    // components/ui/ScreenHeader.tsx) gösteriyor — native-stack header'ı
    // hepsinde kapalı, tekrar eden çift başlık olmasın diye.
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="BusinessCardScan" component={BusinessCardScanScreen} />
      <Stack.Screen name="DoctorVisits" component={DoctorVisitsScreen} />
      <Stack.Screen name="Agenda" component={AgendaScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="AIAnalysis" component={AIAnalysisScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Opportunities" component={OpportunitiesScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Quotes" component={QuotesScreen} />
      <Stack.Screen name="Congresses" component={CongressesScreen} />
      <Stack.Screen name="CongressDetail" component={CongressDetailScreen} />
      <Stack.Screen name="Targets" component={TargetsScreen} />
      <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
      <Stack.Screen name="Stock" component={StockScreen} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <Stack.Screen name="WeeklyPlan" component={WeeklyPlanScreen} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
    </Stack.Navigator>
  )
}
