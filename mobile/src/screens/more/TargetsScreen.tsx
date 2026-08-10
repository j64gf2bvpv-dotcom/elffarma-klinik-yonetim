import * as React from 'react'
import { RefreshControl, Text, View } from 'react-native'
import { format, startOfMonth } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Target, TrendingUp, ShoppingCart, Stethoscope } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatCard } from '@/components/ui/StatCard'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useSalesReps } from '@/features/salesReps/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Targets'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Master talimat §29'daki Hedef Sistemi'nin mobil karşılığı — "Aylık satış
 * hedefi / Gerçekleşen / Başarı %" görünümü. sales_reps ile staff arasında
 * FK yok (masaüstünde de aynı), bu yüzden giriş yapan personelin adı
 * sales_reps.name ile eşleştirilerek kişisel hedef bulunuyor; eşleşme
 * yoksa (personel henüz bir satış temsilcisi kaydına bağlanmamışsa) bunu
 * açıkça belirten bir mesaj gösteriliyor, sessizce sıfır değer uydurulmuyor.
 */
export function TargetsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { staff } = useAuth()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: salesReps = [] } = useSalesReps()
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allVisits = [] } = useVisits()

  const myRep = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (staff?.full_name ?? '').trim().toLowerCase()),
    [salesReps, staff?.full_name],
  )

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const monthPayments = React.useMemo(
    () => (myRep ? allPayments.filter((p) => p.sales_rep_id === myRep.id && new Date(p.paid_at) >= monthStart) : []),
    [allPayments, myRep, monthStart],
  )
  const monthCollected = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const monthSales = React.useMemo(
    () =>
      myRep
        ? allSales.filter((s) => s.sales_rep_id === myRep.id && s.type === 'sale' && new Date(s.sale_date) >= monthStart)
        : [],
    [allSales, myRep, monthStart],
  )
  const monthSalesTotal = monthSales.reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)

  const monthVisits = React.useMemo(
    () => (myRep ? allVisits.filter((v) => v.sales_rep_id === myRep.id && new Date(v.visit_date) >= monthStart) : []),
    [allVisits, myRep, monthStart],
  )

  const target = myRep?.sales_target != null ? Number(myRep.sales_target) : null
  const progress = target && target > 0 ? monthCollected / target : 0
  const successPct = target && target > 0 ? Math.round((monthCollected / target) * 100) : null

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <Screen
      scroll
      style={{ gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader title="Hedeflerim" subtitle={format(new Date(), 'MMMM yyyy', { locale: trLocale })} />

      {!myRep ? (
        <Card>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
            Hesabınız henüz bir satış temsilcisi kaydına bağlanmamış — yönetici Satış Temsilcileri listesinden
            adınızla eşleşen bir kayıt oluşturursa hedef takibi burada görünür.
          </Text>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Target size={16} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Aylık Ciro Hedefi</Text>
              <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(monthCollected)}</Text>
              {target != null && (
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}> / {currency(target)}</Text>
              )}
            </View>
            {target != null && target > 0 ? (
              <>
                <ProgressBar ratio={progress} color={progress >= 1 ? theme.colors.success : theme.colors.primary} />
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                  Başarı: %{successPct}
                </Text>
              </>
            ) : (
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                Bu ay için hedef belirlenmemiş
              </Text>
            )}
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatCard icon={TrendingUp} label="Bu Ay Tahsilat" value={currency(monthCollected)} sublabel={`${monthPayments.length} işlem`} />
            <StatCard icon={ShoppingCart} label="Bu Ay Satış" value={currency(monthSalesTotal)} sublabel={`${monthSales.length} sipariş`} />
            <StatCard icon={Stethoscope} label="Bu Ay Ziyaret" value={String(monthVisits.length)} sublabel="Toplam" />
          </View>
        </>
      )}
    </Screen>
  )
}
