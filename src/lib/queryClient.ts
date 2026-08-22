import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Bağlantı yokken arka planda başarısız olan yenilemeler için bildirim
      // gösterme — zaten kayıtlı (önbellekteki) veri ekranda kalmaya devam eder.
      if (!navigator.onLine) return
      // Bazı sorgular (ör. AI önerileri) kendi ekran-içi, kullanıcı dostu hata
      // mesajını zaten gösteriyor — bu genel toast üzerine binip ham/teknik
      // sağlayıcı hatasını (ör. Gemini'nin JSON gövdesini) tekrar göstermesin
      // diye `meta: { suppressErrorToast: true }` ile devre dışı bırakılabiliyor
      // (QA taramasında bulundu, 2026-08-23 — bkz. TeamPerformancePage.tsx).
      if (query.meta?.suppressErrorToast) return
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
