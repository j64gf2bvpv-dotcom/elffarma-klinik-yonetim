import * as React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getYear, getMonth, addMonths, isSameMonth } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ChevronDown, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LineChart } from '@/components/ui/LineChart'
import { AppModal } from '@/components/ui/AppModal'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useSales } from '@/features/sales/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useBudgetTargets } from '@/features/budget/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Targets'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const MONTH_OPTIONS_COUNT = 12

/**
 * Kullanıcının paylaştığı "Performans" mockup'ına birebir uyacak şekilde
 * (2026-08-20) yeniden tasarlandı — ay seçici, "Ciro Performansı" kartı
 * (gerçekleşen/hedef + ilerleme çubuğu), Toplam Sipariş/Ziyaret/Ortalama
 * Sipariş satırı, günlük ciro çizgi grafiği. Personel bir sales_reps
 * kaydına bağlıysa KİŞİSEL veriler, değilse (bu ekranın eski "Hedeflerim"
 * halinde olduğu gibi salt "bağlı değil" mesajı yerine) Dashboard'daki
 * goalValue/goalTarget ile AYNI kurumsal düşüş kuralı kullanılıyor — bu
 * ekran artık sadece satış temsilcilerine değil, herkese anlamlı bir
 * "Performans" görünümü sunuyor. Hiçbir sayı uydurulmuyor: seçili aydaki
 * gerçek sales/doctor_visits/budget_targets kayıtlarından hesaplanıyor.
 */
export function TargetsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { staff } = useAuth()
  const [refreshing, setRefreshing] = React.useState(false)
  const [selectedMonth, setSelectedMonth] = React.useState(() => startOfMonth(new Date()))
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const { data: salesReps = [] } = useSalesReps()
  const { data: allSales = [] } = useSales()
  const { data: allVisits = [] } = useVisits()
  const { data: yearTargets = [] } = useBudgetTargets(getYear(selectedMonth))

  const myRep = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (staff?.full_name ?? '').trim().toLowerCase()),
    [salesReps, staff?.full_name],
  )

  const monthStart = selectedMonth
  const monthEnd = endOfMonth(selectedMonth)

  const monthSales = React.useMemo(
    () =>
      allSales.filter((s) => {
        if (s.type !== 'sale') return false
        if (myRep && s.sales_rep_id !== myRep.id) return false
        const d = new Date(s.sale_date)
        return d >= monthStart && d <= monthEnd
      }),
    [allSales, myRep, monthStart, monthEnd],
  )
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)

  const monthVisits = React.useMemo(
    () =>
      allVisits.filter((v) => {
        if (myRep && v.sales_rep_id !== myRep.id) return false
        const d = new Date(v.visit_date)
        return d >= monthStart && d <= monthEnd
      }),
    [allVisits, myRep, monthStart, monthEnd],
  )

  const orgTarget = React.useMemo(
    () => yearTargets.find((t) => t.month === getMonth(selectedMonth) + 1)?.target_revenue ?? null,
    [yearTargets, selectedMonth],
  )
  const target = myRep ? (myRep.sales_target != null ? Number(myRep.sales_target) : null) : orgTarget
  const ratio = target != null && target > 0 ? monthRevenue / target : null
  const pct = ratio != null ? Math.round(ratio * 100) : null

  const averageOrder = monthSales.length > 0 ? monthRevenue / monthSales.length : 0

  const dailyPoints = React.useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    return days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const value = monthSales.filter((s) => s.sale_date === dayStr).reduce((sum, s) => sum + s.quantity * Number(s.unit_price), 0)
      return { label: format(day, 'd MMM', { locale: trLocale }), value }
    })
  }, [monthStart, monthEnd, monthSales])

  const monthOptions = React.useMemo(
    () => Array.from({ length: MONTH_OPTIONS_COUNT }, (_, i) => startOfMonth(addMonths(new Date(), -i))),
    [],
  )

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
      <ScreenHeader title="Performans" />

      <Pressable onPress={() => setPickerOpen(true)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>
            {format(selectedMonth, 'MMMM yyyy', { locale: trLocale })}
          </Text>
          <ChevronDown size={18} color={theme.colors.mutedForeground} />
        </Card>
      </Pressable>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>Ciro Performansı</Text>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.xxl }}>
          {currency(monthRevenue)}
        </Text>
        {target != null && target > 0 ? (
          <>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
              {currency(target)} hedefin %{pct}'si
            </Text>
            <ProgressBar ratio={ratio ?? 0} color={(ratio ?? 0) >= 1 ? theme.colors.success : theme.colors.primary} />
          </>
        ) : (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Bu ay için hedef belirlenmemiş</Text>
        )}
      </Card>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{monthSales.length}</Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Toplam Sipariş</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{monthVisits.length}</Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Toplam Ziyaret</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }} numberOfLines={1}>
            {currency(averageOrder)}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Ortalama Sipariş</Text>
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Günlük Ciro (₺)</Text>
        <LineChart points={dailyPoints} />
      </Card>

      <AppModal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing(5),
              gap: 4,
              maxHeight: '70%',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Ay Seç</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={12}>
                <X size={22} color={theme.colors.foreground} />
              </Pressable>
            </View>
            {monthOptions.map((m) => {
              const active = isSameMonth(m, selectedMonth)
              return (
                <Pressable
                  key={m.toISOString()}
                  onPress={() => {
                    setSelectedMonth(m)
                    setPickerOpen(false)
                  }}
                  style={({ pressed }) => [{ paddingVertical: 12 }, pressed && { opacity: 0.6 }]}
                >
                  <Text
                    style={{
                      color: active ? theme.colors.primary : theme.colors.foreground,
                      fontWeight: active ? '700' : '400',
                    }}
                  >
                    {format(m, 'MMMM yyyy', { locale: trLocale })}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </AppModal>
    </Screen>
  )
}
