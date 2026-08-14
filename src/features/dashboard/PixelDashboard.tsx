import { ShoppingCart, Car, Landmark, Users, Boxes } from 'lucide-react'

import { StatCardSparkline } from './StatCardSparkline'
import { SalesPerformanceCard } from './SalesPerformanceCard'
import { AgendaMiniCard } from './AgendaMiniCard'
import { UpcomingCongressesCard } from './UpcomingCongressesCard'
import { TopProductsListCard } from './TopProductsListCard'
import { SalesRepReportCard } from './SalesRepReportCard'
import { NotificationsCard } from './NotificationsCard'
import { OnlineStaffCard } from './OnlineStaffCard'
import { SoundSettingsCard } from '@/features/soundSettings/SoundSettingsCard'
import { QuickActionsRow } from './QuickActionsRow'
import { useDashboardData } from './useDashboardData'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function PixelDashboard() {
  const data = useDashboardData()

  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        <StatCardSparkline
          icon={ShoppingCart}
          tone="blue"
          label="Toplam Satış"
          value={currency(data.salesStat.current)}
          sublabel="Bu ay"
          deltaPct={data.salesStat.deltaPct}
          sparkline={data.salesStat.sparkline}
          to="/satislar"
        />
        <StatCardSparkline
          icon={Car}
          tone="green"
          label="Araçlar"
          value={currency(data.vehicleStat.current)}
          sublabel={`${data.vehicleCount} araç · aylık gider`}
          deltaPct={data.vehicleStat.deltaPct}
          sparkline={data.vehicleStat.sparkline}
          to="/araclar"
        />
        <StatCardSparkline
          icon={Landmark}
          tone="gold"
          label="Toplam Cari"
          value={currency(data.cariTotals.totalBalance)}
          sublabel="Açık bakiye"
          deltaPct={null}
          sparkline={data.cariSparkline}
          to="/cari-hesap"
        />
        <StatCardSparkline
          icon={Users}
          tone="purple"
          label="Aktif Temsilci"
          value={data.activeSalesRepCount.toLocaleString('tr-TR')}
          sublabel="Toplam"
          deltaPct={null}
          to="/doktor-ziyaretleri"
        />
        <StatCardSparkline
          icon={Boxes}
          tone="orange"
          label="Stokta Ürün"
          value={data.productCount.toLocaleString('tr-TR')}
          sublabel="Ürün çeşidi"
          deltaPct={null}
          to="/stok"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 @[900px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <SalesPerformanceCard timeline={data.salesTimeline} />
        <AgendaMiniCard />
        <UpcomingCongressesCard congresses={data.congresses} />
      </div>

      <div className="grid grid-cols-1 gap-4 @[700px]:grid-cols-3">
        <TopProductsListCard items={data.topProducts} />
        <SalesRepReportCard items={data.repMonthlyReport} />
        <NotificationsCard items={data.notifications} />
        <OnlineStaffCard />
        <SoundSettingsCard />
      </div>

      <QuickActionsRow />
    </div>
  )
}
