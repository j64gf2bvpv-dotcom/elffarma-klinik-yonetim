import type { NavigatorScreenParams } from '@react-navigation/native'

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  ResetPassword: undefined
}

export type DashboardStackParamList = {
  Dashboard: undefined
}

export type DoctorsStackParamList = {
  DoctorsList: undefined
  DoctorDetail: { customerId: string; customerName: string }
  VisitFlow: { customerId: string; customerName: string }
  CreateOrder: { customerId: string; customerName: string }
  CreateQuote: { customerId: string; customerName: string }
}

export type MapStackParamList = {
  Map: undefined
}

export type ActivitiesStackParamList = {
  ActivitiesList: undefined
}

export type MoreStackParamList = {
  MoreMenu: undefined
  ComingSoon: { title: string }
  BusinessCardScan: undefined
  DoctorVisits: undefined
  Agenda: undefined
  Reminders: undefined
  AIAnalysis: undefined
  Settings: undefined
  Opportunities: undefined
  Tasks: undefined
  Quotes: undefined
  Congresses: undefined
  CongressDetail: { congressId: string; congressName: string }
  Targets: undefined
  AuditLogs: undefined
  Stock: { onlyCritical?: boolean } | undefined
  WeeklyReport: undefined
  WeeklyPlan: undefined
}

export type MainTabParamList = {
  AnaSayfaTab: undefined
  DoktorlarTab: NavigatorScreenParams<DoctorsStackParamList>
  HaritaTab: undefined
  AktivitelerTab: undefined
  DigerTab: NavigatorScreenParams<MoreStackParamList>
}
