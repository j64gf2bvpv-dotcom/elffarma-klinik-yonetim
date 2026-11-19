import * as React from 'react'
import { CariKartHub, AjandaHub, AyarlarHub } from '@/routes/hubs'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/routes/LoginPage'
import { ResetPasswordPage } from '@/routes/ResetPasswordPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { CustomerDetailPage } from '@/routes/CustomerDetailPage'
import { InstagramLeadsPage } from '@/routes/InstagramLeadsPage'
import { CariHesapPage } from '@/routes/CariHesapPage'
import { ExpensesPage } from '@/routes/ExpensesPage'
import { StockPage } from '@/routes/StockPage'
import { CongressesPage } from '@/routes/CongressesPage'
import { CongressDetailPage } from '@/routes/CongressDetailPage'
import { DoctorVisitsPage } from '@/routes/DoctorVisitsPage'
import { TasksPage } from '@/routes/TasksPage'
import { VehiclesPage } from '@/routes/VehiclesPage'
import { PersonnelPage } from '@/routes/PersonnelPage'
import { PersonnelDetailPage } from '@/routes/PersonnelDetailPage'
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
            <Route path="musteriler" element={<CariKartHub />} />
            <Route path="musteriler/:id" element={<CustomerDetailPage />} />
            <Route path="prim" element={<Navigate to="/doktor-ziyaretleri?bolum=prim" replace />} />
            <Route path="crm" element={<Navigate to="/doktor-ziyaretleri?bolum=crm" replace />} />
            <Route path="ai-analiz" element={<Navigate to="/ayarlar?bolum=ai" replace />} />
            <Route path="instagram-doktor-listesi" element={<InstagramLeadsPage />} />
            <Route path="cari-hesap" element={<Navigate to="/musteriler?bolum=cari-hesap" replace />} />
            <Route path="cari-hesap/:id" element={<CariHesapPage />} />
            <Route path="stok" element={<StockPage />} />
            <Route path="tahsilatlar" element={<Navigate to="/musteriler?bolum=tahsilatlar" replace />} />
            <Route path="giderler" element={<ExpensesPage />} />
            <Route path="butce-yili" element={<Navigate to="/musteriler?bolum=butce" replace />} />
            <Route path="kongreler" element={<CongressesPage />} />
            <Route path="kongreler/:id" element={<CongressDetailPage />} />
            <Route path="doktor-ziyaretleri" element={<DoctorVisitsPage />} />
            <Route path="satislar" element={<Navigate to="/musteriler?bolum=satislar" replace />} />
            <Route path="hatirlatmalar" element={<Navigate to="/ajanda?bolum=hatirlatmalar" replace />} />
            <Route path="gorevler" element={<TasksPage />} />
            <Route path="ajanda" element={<AjandaHub />} />
            <Route path="araclar" element={<VehiclesPage />} />
            <Route path="ekip-performansi" element={<Navigate to="/doktor-ziyaretleri?bolum=ekip" replace />} />
            <Route path="faturalar" element={<Navigate to="/giderler?bolum=fatura_takibi" replace />} />
            <Route path="personel" element={<PersonnelPage />} />
            <Route path="personel/:id" element={<PersonnelDetailPage />} />
            <Route path="ayarlar" element={<AyarlarHub />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
