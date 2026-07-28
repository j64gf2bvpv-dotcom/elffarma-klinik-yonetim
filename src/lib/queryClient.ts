import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Bağlantı yokken arka planda başarısız olan yenilemeler için bildirim
      // gösterme — zaten kayıtlı (önbellekteki) veri ekranda kalmaya devam eder.
      if (!navigator.onLine) return
      toast.error('Veri yüklenemedi', { description: error.message })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
