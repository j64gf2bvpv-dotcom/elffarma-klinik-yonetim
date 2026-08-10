export type RootStackParamList = {
  Login: undefined
  Main: undefined
  ResetPassword: undefined
}

export type DashboardStackParamList = {
  Dashboard: undefined
}

export type LiveStackParamList = {
  Live: undefined
}

export type CustomersStackParamList = {
  CustomersList: undefined
  CustomerDetail: { customerId: string; customerName: string }
}

export type ActivitiesStackParamList = {
  ActivitiesList: undefined
}

export type MoreStackParamList = {
  MoreMenu: undefined
  ComingSoon: { title: string }
  BusinessCardScan: undefined
  Map: undefined
  DoctorVisits: undefined
  Agenda: undefined
  Reminders: undefined
  AIAnalysis: undefined
  Settings: undefined
  Opportunities: undefined
  Tasks: undefined
}

export type MainTabParamList = {
  LiveTab: undefined
  CustomersTab: undefined
  ActivitiesTab: undefined
  DashboardTab: undefined
  DigerTab: undefined
}
