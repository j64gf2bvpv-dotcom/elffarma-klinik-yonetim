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

export type OrdersStackParamList = {
  OrdersList: undefined
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
  TeamChat: undefined
  Profile: undefined
  Support: undefined
}

export type MainTabParamList = {
  AnaSayfaTab: undefined
  DoktorlarTab: NavigatorScreenParams<DoctorsStackParamList>
  YeniSiparisTab: undefined
  SiparislerTab: NavigatorScreenParams<OrdersStackParamList>
  DigerTab: NavigatorScreenParams<MoreStackParamList>
  // Ana sekme çubuğunda artık görünmüyor (kullanıcı isteğiyle pazarlama
  // görselindeki 5 sekmeye indirildi: Ana Sayfa/Müşteriler/+/Siparişler/
  // Daha Fazla) ama Daha Fazla menüsünden hâlâ erişilebiliyor — bu yüzden
  // navigator'dan tamamen kaldırılmadı, sadece tabBarButton gizlendi.
  HaritaTab: undefined
  AktivitelerTab: undefined
}
