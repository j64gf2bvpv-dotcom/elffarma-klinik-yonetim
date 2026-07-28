import * as React from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, AdminRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/routes/LoginPage'
import { ResetPasswordPage } from '@/routes/ResetPasswordPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { CustomersPage } from '@/routes/CustomersPage'
import { CustomerDetailPage } from '@/routes/CustomerDetailPage'
import { CariHesapPage } from '@/routes/CariHesapPage'
import { CariHesapListPage } from '@/routes/CariHesapListPage'
import { BudgetYearPage } from '@/routes/BudgetYearPage'
import { ExpensesPage } from '@/routes/ExpensesPage'
import { StockPage } from '@/routes/StockPage'
import { PaymentsPage } from '@/routes/PaymentsPage'
import { CongressesPage } from '@/routes/CongressesPage'
import { CongressDetailPage } from '@/routes/CongressDetailPage'
import { WorkshopsPage } from '@/routes/WorkshopsPage'
import { WorkshopDetailPage } from '@/routes/WorkshopDetailPage'
import { DoctorVisitsPage } from '@/routes/DoctorVisitsPage'
import { SalesPage } from '@/routes/SalesPage'
import { RemindersPage } from '@/routes/RemindersPage'
import { AgendaPage } from '@/routes/AgendaPage'
import { EFaturaPage } from '@/routes/EFaturaPage'
import { SettingsPage } from '@/routes/SettingsPage'
import { supabase } from '@/lib/supabaseClient'

// Şifre sıfırlama e-postasındaki bağlantı tıklandığında Electron main süreci
// token'ları IPC ile buraya gönderir; oturumu bu token'larla kurup kullanıcıyı
// yeni şifre belirleme sayfasına yönlendiriyoruz.
function DeepLinkListener() {
  const navigate = useNavigate()

  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.onDeepLinkRecovery?.(async ({ access_token, refresh_token }) => {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (!error) navigate('/sifre-sifirla')
    })
    return () => unsubscribe?.()
  }, [navigate])

  return null
}

function App() {
  return (
    <HashRouter>
      <DeepLinkListener />
      <Routes>
        <Route path="/giris" element={<LoginPage />} />
        <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="musteriler" element={<CustomersPage />} />
            <Route path="musteriler/:id" element={<CustomerDetailPage />} />
            <Route path="cari-hesap" element={<CariHesapListPage />} />
            <Route path="cari-hesap/:id" element={<CariHesapPage />} />
            <Route path="stok" element={<StockPage />} />
            <Route path="tahsilatlar" element={<PaymentsPage />} />
            <Route path="giderler" element={<ExpensesPage />} />
            <Route path="butce-yili" element={<BudgetYearPage />} />
            <Route path="kongreler" element={<CongressesPage />} />
            <Route path="kongreler/:id" element={<CongressDetailPage />} />
            <Route path="workshoplar" element={<WorkshopsPage />} />
            <Route path="workshoplar/:id" element={<WorkshopDetailPage />} />
            <Route path="doktor-ziyaretleri" element={<DoctorVisitsPage />} />
            <Route path="satislar" element={<SalesPage />} />
            <Route path="hatirlatmalar" element={<RemindersPage />} />
            <Route path="ajanda" element={<AgendaPage />} />
            <Route path="e-fatura" element={<EFaturaPage />} />
            <Route element={<AdminRoute />}>
              <Route path="ayarlar" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
