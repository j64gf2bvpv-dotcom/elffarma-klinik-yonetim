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
}

export type MainTabParamList = {
  AnaSayfaTab: undefined
  DoktorlarTab: undefined
  HaritaTab: undefined
  AktivitelerTab: undefined
  DigerTab: undefined
}
