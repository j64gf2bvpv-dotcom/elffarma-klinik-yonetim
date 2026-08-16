import * as React from 'react'
import { Image, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Package, FileText, Building2 } from 'lucide-react-native'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useSales } from '@/features/sales/hooks'
import { useQuotes } from '@/features/quotes/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useCurrentMonthTarget } from '@/features/budget/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import type { DashboardStackParamList, MainTabParamList } from '@/navigation/types'

type Props = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, 'Dashboard'>,
  BottomTabScreenProps<MainTabParamList>
>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** "Günlük Özet" kartındaki üç eşit sütun — pazarlama görselindeki gibi
 * ikonsuz, kalın rakam + altında etiket. */
function DailyStatCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', borderRightWidth: last ? 0 : 1, borderRightColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

interface ActivityItem {
  id: string
  icon: typeof Package
  iconColor: string
  name: string
  action: string
  time: string
  amount: string | null
}

/** İsim / eylem / tarih-saat üç satır solda, belirlenen tutar sağda —
 * kullanıcı isteğiyle (2026-08-17) sepet ikonu yerine kurumsal bir ikon
 * (Package) kullanılıyor. */
function ActivityRow({ item, first }: { item: ActivityItem; first: boolean }) {
  const theme = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: theme.spacing(3),
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: item.iconColor + '1f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <item.icon size={15} color={item.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.sm }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 2 }} numberOfLines={1}>
          {item.action}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{item.time}</Text>
      </View>
      {item.amount && (
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.sm }}>{item.amount}</Text>
      )}
    </View>
  )
}

/**
 * Pazarlama görselindeki Ana Sayfa ile birebir — kullanıcı isteğiyle
 * (2026-08-17) "sadece mockuptaki gibi: Günlük Özet, Hedeflerim, Son
 * Aktiviteler" — önceki sürümdeki duyuru banner'ı, ek istatistik satırı,
 * Görevlerim ve CRM bağlantısı kaldırıldı (kod silinmedi sayılmaz, bu
 * ekranda gösterilmiyor sadece; Görevler zaten Daha Fazla'da ayrı bir
 * ekran olarak duruyor). Üst satır da görseldeki gibi solda elfFARMA
 * yazı-logosu, sağda personelin küçük yuvarlak avatarı (dokununca
 * Profil Bilgileri'ne gider).
 */
export function DashboardScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: allPayments = [] } = usePayments({})
  const { data: sales = [] } = useSales()
  const { data: quotes = [] } = useQuotes('all')
  const { data: monthTarget } = useCurrentMonthTarget()
  const { data: salesReps = [] } = useSalesReps()
  const { data: visits = [] } = useVisits()

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todaysVisits = React.useMemo(() => visits.filter((v) => v.visit_date === todayStr), [visits, todayStr])

  const myRep = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (staff?.full_name ?? '').trim().toLowerCase()),
    [salesReps, staff?.full_name],
  )

  const monthStart = React.useMemo(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), [])
  const monthPayments = React.useMemo(
    () => allPayments.filter((p) => p.paid_at.slice(0, 10) >= monthStart),
    [allPayments, monthStart],
  )
  const monthTotal = React.useMemo(() => monthPayments.reduce((sum, p) => sum + Number(p.amount), 0), [monthPayments])
  const myMonthCollected = React.useMemo(
    () => (myRep ? monthPayments.filter((p) => p.sales_rep_id === myRep.id).reduce((sum, p) => sum + Number(p.amount), 0) : 0),
    [monthPayments, myRep],
  )
  const myTarget = myRep?.sales_target != null ? Number(myRep.sales_target) : null

  // Personel bir sales_reps kaydına bağlıysa KİŞİSEL hedefi/tahsilatı,
  // değilse kurum genelini gösteriyoruz — "Hedeflerim" ekranındaki aynı
  // bağlanma deseni.
  const goalValue = myRep ? myMonthCollected : monthTotal
  const goalTarget = myRep ? myTarget : monthTarget ?? null
  const goalRatio = goalTarget != null && goalTarget > 0 ? goalValue / goalTarget : null

  const todaysSales = React.useMemo(() => sales.filter((s) => s.sale_date === todayStr && s.type === 'sale'), [sales, todayStr])
  const todaysRevenue = React.useMemo(() => todaysSales.reduce((sum, s) => sum + s.quantity * s.unit_price, 0), [todaysSales])

  // "Son Aktiviteler" — satış/ziyaret/teklif kayıtlarını tek bir kronolojik
  // listede birleştiriyor. Kullanıcı isteğiyle (2026-08-17) satır düzeni:
  // isim / eylem / tarih-saat alt alta solda, belirlenen tutar sağda; satış
  // ikonu artık sepet değil, kurumsal bir paket/kutu ikonu.
  const recentActivity = React.useMemo<ActivityItem[]>(() => {
    const items: (ActivityItem & { sortAt: string })[] = []
    for (const s of sales.slice(0, 20)) {
      if (s.type !== 'sale') continue
      items.push({
        id: `sale-${s.id}`,
        icon: Package,
        iconColor: theme.colors.primary,
        name: s.customers?.full_name ?? 'Müşteri',
        action: 'Sipariş oluşturuldu',
        time: format(new Date(s.sale_date), 'd MMMM yyyy, HH:mm', { locale: trLocale }),
        amount: currency(s.quantity * s.unit_price),
        sortAt: s.sale_date,
      })
    }
    for (const v of visits.slice(0, 20)) {
      if (!v.check_in_at) continue
      items.push({
        id: `visit-${v.id}`,
        icon: Building2,
        iconColor: theme.colors.success,
        name: v.doctor_name,
        action: 'Ziyaret gerçekleştirildi',
        time: format(new Date(v.check_in_at), 'd MMMM yyyy, HH:mm', { locale: trLocale }),
        amount: null,
        sortAt: v.check_in_at,
      })
    }
    for (const q of quotes.slice(0, 20)) {
      items.push({
        id: `quote-${q.id}`,
        icon: FileText,
        iconColor: theme.colors.warning,
        name: q.customer_name ?? 'Müşteri',
        action: 'Yeni teklif oluşturuldu',
        time: format(new Date(q.created_at), 'd MMMM yyyy, HH:mm', { locale: trLocale }),
        amount: null,
        sortAt: q.created_at,
      })
    }
    return items.sort((a, b) => b.sortAt.localeCompare(a.sortAt)).slice(0, 8)
  }, [sales, visits, quotes, theme])

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.base, fontWeight: '300', letterSpacing: 0.3 }}>
            elf<Text style={{ fontWeight: '900' }}>FARMA</Text>
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontStyle: 'italic', marginTop: -1 }}>
            Estetik Sanatı
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('DigerTab', { screen: 'Profile' })} hitSlop={8}>
          {staff?.avatar_url ? (
            <Image source={{ uri: staff.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: theme.colors.primary + '26',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
                {initials(staff?.full_name || '?')}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
            Günlük Özet
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            {format(new Date(), 'd MMMM yyyy, EEEE', { locale: trLocale })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <DailyStatCell label="Ziyaret" value={todaysVisits.length.toLocaleString('tr-TR')} />
          <DailyStatCell label="Sipariş" value={todaysSales.length.toLocaleString('tr-TR')} />
          <DailyStatCell label="Ciro" value={currency(todaysRevenue)} last />
        </View>
      </Card>

      <View>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600', marginBottom: 8 }}>
          Hedeflerim
        </Text>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>Aylık Ciro Hedefi</Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
              {goalTarget ? `${currency(goalValue)} / ${currency(goalTarget)}` : 'Hedef belirle'}
            </Text>
          </View>
          {goalRatio != null ? (
            <ProgressBar ratio={goalRatio} color={goalRatio >= 1 ? theme.colors.success : theme.colors.primary} />
          ) : (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Bu ay için hedef belirlenmemiş</Text>
          )}
        </Card>
      </View>

      <View>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600', marginBottom: 8 }}>
          Son Aktiviteler
        </Text>
        <Card style={{ gap: 0, padding: 0 }}>
          {recentActivity.length === 0 && (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, padding: theme.spacing(4) }}>
              Henüz bir aktivite yok
            </Text>
          )}
          {recentActivity.map((item, i) => (
            <ActivityRow key={item.id} item={item} first={i === 0} />
          ))}
        </Card>
      </View>
    </Screen>
  )
}
