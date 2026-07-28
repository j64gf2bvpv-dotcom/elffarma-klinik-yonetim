import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { queryClient } from './lib/queryClient'
import { Toaster } from '@/components/ui/sonner'

// Sorgu önbelleğini diske yazar — internet olmadan uygulama yeniden açılsa
// bile en son yüklenen veriler (doktorlar, stok, tahsilatlar vb.) ekranda görünür.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'elffarma-query-cache',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
    >
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
