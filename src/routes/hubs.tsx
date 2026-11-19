import { Users, BookOpenText, HandCoins, ShoppingCart, PiggyBank, CalendarDays, BellRing, Settings, Sparkles } from 'lucide-react'

import { PageHub } from '@/components/layout/PageHub'
import { CustomersPage } from '@/routes/CustomersPage'
import { CariHesapListPage } from '@/routes/CariHesapListPage'
import { PaymentsPage } from '@/routes/PaymentsPage'
import { SalesPage } from '@/routes/SalesPage'
import { BudgetYearPage } from '@/routes/BudgetYearPage'
import { AgendaPage } from '@/routes/AgendaPage'
import { RemindersPage } from '@/routes/RemindersPage'
import { SettingsPage } from '@/routes/SettingsPage'
import { AIInsightsPage } from '@/routes/AIInsightsPage'

/**
 * Cari Kart: doktorlar + tahsilatlar + satışlar + bütçe yılı tek menüde (kullanıcı isteği, 2026-11-19:
 * "cari hesap, satışlar, bütçe yılı, tahsilatlar cari kartın içinde olsun, entegre çalışsın").
 */
export function CariKartHub() {
  return (
    <PageHub
      tabs={[
        { key: 'doktorlar', label: 'Doktorlar', icon: Users, render: () => <CustomersPage /> },
        { key: 'cari-hesap', label: 'Cari Hesap', icon: BookOpenText, navKey: 'cariHesap', render: () => <CariHesapListPage /> },
        { key: 'tahsilatlar', label: 'Tahsilatlar', icon: HandCoins, navKey: 'payments', render: () => <PaymentsPage /> },
        { key: 'satislar', label: 'Satışlar', icon: ShoppingCart, navKey: 'sales', render: () => <SalesPage /> },
        { key: 'butce', label: 'Bütçe Yılı', icon: PiggyBank, navKey: 'budget', render: () => <BudgetYearPage /> },
      ]}
    />
  )
}

/** Ajanda + Hatırlatmalar tek menüde (kullanıcı isteği, 2026-11-19: "hatırlatmalar ajanda içinde olsun") */
export function AjandaHub() {
  return (
    <PageHub
      tabs={[
        { key: 'takvim', label: 'Ajanda', icon: CalendarDays, render: () => <AgendaPage /> },
        { key: 'hatirlatmalar', label: 'Hatırlatmalar', icon: BellRing, navKey: 'reminders', render: () => <RemindersPage /> },
      ]}
    />
  )
}

/** Ayarlar + Yapay Zeka Analiz (kullanıcı isteği, 2026-11-19: "yapay zeka analiz de ayarlar kısmında olsun") */
export function AyarlarHub() {
  return (
    <PageHub
      tabs={[
        { key: 'genel', label: 'Ayarlar', icon: Settings, render: () => <SettingsPage /> },
        { key: 'ai', label: 'Yapay Zeka Analiz', icon: Sparkles, navKey: 'aiInsights', render: () => <AIInsightsPage /> },
      ]}
    />
  )
}
