import * as React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { addWeeks, eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ChevronLeft, ChevronRight, Package, Stethoscope } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useStaffList } from '@/features/staff/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useStockMovements } from '@/features/stock/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'WeeklyReport'>

/**
 * "Satış temsilcilerinin haftalık ziyaret listesi — gün gün hangi doktora ne
 * ürün verildiği" raporu. doctor_visits.sales_rep_id sales_reps(id)'ye,
 * stock_movements.staff_id ise staff(id)'ye FK'lı (iki farklı id uzayı) —
 * bu yüzden bir personel seçilince hem kendi staff.id'si (numuneler için)
 * hem isim eşleşmesiyle bulunan sales_reps.id'si (ziyaretler için) birlikte
 * kullanılıyor, aynı Hedeflerim/Benim Doktorlarım'daki bağlanma deseni.
 * Admin herhangi bir personeli seçebilir, personel sadece kendi raporunu görür.
 */
export function WeeklyReportScreen(_: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'admin'
  const { data: staffList = [] } = useStaffList()
  const { data: salesReps = [] } = useSalesReps()

  const [weekAnchor, setWeekAnchor] = React.useState(new Date())
  const [selectedStaffId, setSelectedStaffId] = React.useState<string | undefined>(staff?.id)

  React.useEffect(() => {
    if (!selectedStaffId && staff?.id) setSelectedStaffId(staff.id)
  }, [staff?.id, selectedStaffId])

  const viewedStaff = staffList.find((s) => s.id === selectedStaffId) ?? staff
  const myRep = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (viewedStaff?.full_name ?? '').trim().toLowerCase()),
    [salesReps, viewedStaff?.full_name],
  )

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const { data: visits = [] } = useVisits(weekStartStr, weekEndStr)
  const { data: movements = [] } = useStockMovements(
    viewedStaff?.id,
    `${weekStartStr}T00:00:00`,
    `${weekEndStr}T23:59:59`,
    ['sample'],
  )

  const myVisits = React.useMemo(
    () => (myRep ? visits.filter((v) => v.sales_rep_id === myRep.id) : []),
    [visits, myRep],
  )

  const totalSamples = movements.reduce((sum, m) => sum + m.quantity, 0)

  return (
    <Screen scroll style={{ gap: 12 }}>
      <ScreenHeader title="Haftalık Rapor" subtitle="Ziyaret + verilen numune, gün gün" />

      {isAdmin && staffList.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {staffList.map((s) => (
            <Pressable key={s.id} onPress={() => setSelectedStaffId(s.id)} hitSlop={4}>
              <Badge variant={selectedStaffId === s.id ? 'default' : 'outline'}>{s.full_name}</Badge>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setWeekAnchor((d) => subWeeks(d, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={theme.colors.foreground} />
        </Pressable>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
          {format(weekStart, 'd MMM', { locale: trLocale })} – {format(weekEnd, 'd MMM yyyy', { locale: trLocale })}
        </Text>
        <Pressable onPress={() => setWeekAnchor((d) => addWeeks(d, 1))} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight size={20} color={theme.colors.foreground} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Ziyaret</Text>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.xl }}>{myVisits.length}</Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Verilen Numune</Text>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.xl }}>{totalSamples}</Text>
        </Card>
      </View>

      {!myRep && !isAdmin && (
        <Card>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
            Hesabınız henüz bir satış temsilcisi kaydına bağlanmamış — ziyaret verileri bu yüzden boş görünüyor. Numune
            verileri (stok hareketi) kendi hesabınıza göre yine de gösteriliyor.
          </Text>
        </Card>
      )}

      {days.map((day) => {
        const dayVisits = myVisits.filter((v) => isSameDay(new Date(v.visit_date), day))
        const dayMovements = movements.filter((m) => isSameDay(new Date(m.created_at), day))
        if (dayVisits.length === 0 && dayMovements.length === 0) return null
        return (
          <Card key={day.toISOString()} style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
              {format(day, 'EEEE, d MMMM', { locale: trLocale })}
            </Text>
            {dayVisits.map((v) => {
              const samplesForDoctor = dayMovements.filter((m) => m.customer_id === v.customer_id)
              return (
                <View key={v.id} style={{ gap: 4, borderLeftWidth: 2, borderLeftColor: theme.colors.border, paddingLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Stethoscope size={13} color={theme.colors.foreground} />
                    <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm, flex: 1 }}>
                      {v.doctor_name}
                    </Text>
                    {v.check_in_at && (
                      <Badge variant="outline">{format(new Date(v.check_in_at), 'HH:mm')}</Badge>
                    )}
                  </View>
                  {samplesForDoctor.map((s) => (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 19 }}>
                      <Package size={11} color={theme.colors.mutedForeground} />
                      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                        {s.product_name} × {s.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            })}
            {dayMovements.filter((m) => !dayVisits.some((v) => v.customer_id === m.customer_id)).length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
                  Ziyaret dışı numuneler
                </Text>
                {dayMovements
                  .filter((m) => !dayVisits.some((v) => v.customer_id === m.customer_id))
                  .map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Package size={11} color={theme.colors.mutedForeground} />
                      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                        {m.product_name} × {m.quantity}{m.customer_name ? ` — ${m.customer_name}` : ''}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </Card>
        )
      })}

      {myVisits.length === 0 && movements.length === 0 && (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center', marginTop: 20 }}>
          Bu hafta için kayıt yok
        </Text>
      )}
    </Screen>
  )
}
