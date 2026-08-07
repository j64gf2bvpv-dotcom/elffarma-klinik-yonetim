import * as React from 'react'
import { RefreshControl, Text, View } from 'react-native'
import { startOfMonth } from 'date-fns'
import { ShoppingCart, Landmark, Boxes, AlertTriangle } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { StatCard } from '@/components/ui/StatCard'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useCustomers } from '@/features/customers/hooks'
import { useProducts } from '@/features/stock/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { computeCariLedger, computeCariTotals } from '@shared/businessLogic/cariLedger'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Masaüstündeki DashboardPage'in Faz 1 sadeleştirilmiş karşılığı — plan'da
 * belirtildiği gibi grafik/AI-uyarı/widget-sürükleme yok, sadece gerçek
 * verilerle dolu birkaç stat kartı. "Açık hatırlatma sayısı" örneği plandaki
 * bir öneriydi; hatırlatmalar modülü Faz 1 kapsamında yok, bu yüzden onun
 * yerine (aynı derecede "gerçek veri" kanıtlayan) toplam açık cari bakiye
 * kullanıldı.
 */
export function DashboardScreen() {
  const theme = useTheme()
  const { staff, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: customers = [], isLoading: customersLoading } = useCustomers('')
  const { data: products = [], isLoading: productsLoading } = useProducts('')
  const { data: allPayments = [] } = usePayments({})
  const { data: sales = [] } = useSales()
  const { data: invoices = [] } = useInvoices()

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const monthTotal = React.useMemo(
    () => allPayments.filter((p) => new Date(p.paid_at) >= monthStart).reduce((sum, p) => sum + Number(p.amount), 0),
    [allPayments, monthStart],
  )
  const criticalStockCount = React.useMemo(
    () => products.filter((p) => p.current_quantity <= p.critical_stock_threshold).length,
    [products],
  )
  const cariTotals = React.useMemo(() => {
    const ledger = computeCariLedger(allPayments, sales, invoices)
    return computeCariTotals(customers, ledger)
  }, [allPayments, sales, invoices, customers])

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const loading = customersLoading || productsLoading

  return (
    <Screen
      scroll
      style={{ gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <View style={{ marginBottom: 4 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700' }}>
          Hoş geldiniz{staff?.full_name ? `, ${staff.full_name}` : ''}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
          {staff?.role === 'admin' ? 'Yönetici' : 'Personel'}
        </Text>
      </View>

      <PendingSyncBadge />

      {loading ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon={ShoppingCart} label="Tahsilatlar" value={currency(monthTotal)} sublabel="Bu ay" />
          <StatCard icon={Landmark} label="Toplam Cari" value={currency(cariTotals.totalBalance)} sublabel="Açık bakiye" />
          <StatCard icon={Boxes} label="Ürün Çeşidi" value={products.length.toLocaleString('tr-TR')} sublabel="Aktif" />
          <StatCard
            icon={AlertTriangle}
            label="Kritik Stok"
            value={criticalStockCount.toLocaleString('tr-TR')}
            sublabel="Ürün"
          />
        </View>
      )}

      <View style={{ marginTop: 24, alignItems: 'flex-start' }}>
        <Text onPress={signOut} style={{ color: theme.colors.destructive, fontWeight: '600' }}>
          Çıkış Yap
        </Text>
      </View>
    </Screen>
  )
}
