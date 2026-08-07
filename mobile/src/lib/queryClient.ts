import { QueryCache, QueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { isOnline } from './netInfoState'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Bağlantı yokken arka planda başarısız olan yenilemeler için bildirim
      // gösterme — zaten kayıtlı (önbellekteki) veri ekranda kalmaya devam eder.
      if (!isOnline()) return
      Toast.show({ type: 'error', text1: 'Veri yüklenemedi', text2: error.message })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      // refetchOnWindowFocus'un RN karşılığı yok (pencere odağı kavramı yok) —
      // AppState-tabanlı "uygulama öne geldiğinde yenile" davranışı istenirse
      // sonraki fazda eklenebilir, Faz 1'de gerekli değil.
    },
    mutations: {
      retry: 0,
    },
  },
})
