export type RootStackParamList = {
  Login: undefined
  Main: undefined
  ResetPassword: undefined
}

export type DashboardStackParamList = {
  Dashboard: undefined
}

export type CariHesapStackParamList = {
  CariHesapList: undefined
  CariHesapDetail: { customerId: string; customerName: string }
}

export type StockStackParamList = {
  StockList: undefined
  RecordMovement: { productId: string; productName: string; currentQuantity: number; unit: string }
}

export type PaymentsStackParamList = {
  PaymentsList: undefined
  RecordPayment: undefined
}

export type MoreStackParamList = {
  MoreMenu: undefined
  ComingSoon: { title: string }
  CrmActivities: undefined
  BusinessCardScan: undefined
  Map: undefined
}

export type MainTabParamList = {
  AnasayfaTab: undefined
  StokTab: undefined
  CariHesapTab: undefined
  TahsilatlarTab: undefined
  DigerTab: undefined
}
