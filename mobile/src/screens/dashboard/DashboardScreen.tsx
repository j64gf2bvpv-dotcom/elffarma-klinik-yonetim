import * as React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast, isToday, startOfMonth } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  ShoppingCart,
  Landmark,
  Boxes,
  Megaphone,
  Bell,
  RefreshCw,
  Circle,
  Target,
  TrendingUp,
  Stethoscope,
  ChevronRight,
  PlayCircle,
  Building2,
} from 'lucide-react-native'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useCustomers } from '@/features/customers/hooks'
import { useProducts } from '@/features/stock/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { useCurrentMonthTarget } from '@/features/budget/hooks'
import { useMyTasks, useUpdateTaskStatus } from '@/features/tasks/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useReminders } from '@/features/reminders/hooks'
import { computeCariLedger, computeCariTotals } from '@shared/businessLogic/cariLedger'
import type { DashboardStackParamList, MainTabParamList } from '@/navigation/types'

type Props = CompositeScreenProps<
  NativeStackScreenProps<DashboardStackParamList, 'Dashboard'>,
  BottomTabScreenProps<MainTabParamList>
>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function SectionHeader({ title, onPressMore }: { title: string; onPressMore?: () => void }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>{title}</Text>
      {onPressMore && (
        <Pressable onPress={onPressMore} hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.xs, fontWeight: '700' }}>Tümü</Text>
        </Pressable>
      )}
    </View>
  )
}

function GoalCard({
  icon: Icon,
  title,
  tags,
  value,
  target,
  ratio,
}: {
  icon: typeof Target
  title: string
  tags: string[]
  value: string
  target: string | null
  ratio: number | null
}) {
  const theme = useTheme()
  const color = ratio == null ? theme.colors.primary : ratio >= 1 ? theme.colors.success : ratio >= 0.5 ? theme.colors.primary : theme.colors.warning
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>{title}</Text>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{value}</Text>
        {target && <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}> /{target}</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag}
          </Badge>
        ))}
      </View>
      {ratio != null ? (
        <ProgressBar ratio={ratio} color={color} />
      ) : (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Bu ay için hedef belirlenmemiş</Text>
      )}
    </Card>
  )
}

/**
 * gocust'un mobil CRM tanıtım sayfasındaki Dashboard yerleşiminden (karşılama
 * başlığı, duyuru/uyarı banner'ı, etiketli ilerleme çubuğu hedef kartları,
 * günün ziyaretleri, görev listesi) ilham alınarak Elffarma marka renkleriyle
 * ve gerçek veriyle yeniden kurulmuş hâli — hiçbir sayı/metin uydurulmadı:
 * hedef yoksa ilerleme çubuğu yerine düz metin, kişisel ciro hedefi ancak
 * personel bir sales_reps kaydına isim-eşleşmesiyle bağlıysa gösterilir
 * (bkz. Hedeflerim ekranı, aynı bağlanma deseni).
 */
export function DashboardScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: customers = [], isLoading: customersLoading } = useCustomers('')
  const { data: products = [], isLoading: productsLoading } = useProducts('')
  const { data: allPayments = [] } = usePayments({})
  const { data: sales = [] } = useSales()
  const { data: invoices = [] } = useInvoices()
  const { data: monthTarget } = useCurrentMonthTarget()
  const { data: myTasks = [] } = useMyTasks()
  const { data: salesReps = [] } = useSalesReps()
  const { data: reminders = [] } = useReminders()
  const updateTaskStatus = useUpdateTaskStatus()

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { data: todaysVisits = [] } = useVisits(todayStr, todayStr)

  const myRep = React.useMemo(
    () => salesReps.find((r) => r.name.trim().toLowerCase() === (staff?.full_name ?? '').trim().toLowerCase()),
    [salesReps, staff?.full_name],
  )

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const monthPayments = React.useMemo(
    () => allPayments.filter((p) => new Date(p.paid_at) >= monthStart),
    [allPayments, monthStart],
  )
  const monthTotal = React.useMemo(
    () => monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    [monthPayments],
  )
  const myMonthCollected = React.useMemo(
    () => (myRep ? monthPayments.filter((p) => p.sales_rep_id === myRep.id).reduce((sum, p) => sum + Number(p.amount), 0) : 0),
    [monthPayments, myRep],
  )
  const myTarget = myRep?.sales_target != null ? Number(myRep.sales_target) : null

  const criticalStockCount = React.useMemo(
    () => products.filter((p) => p.current_quantity <= p.critical_stock_threshold).length,
    [products],
  )
  const overdueTasksCount = React.useMemo(
    () => myTasks.filter((t) => t.due_date != null && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length,
    [myTasks],
  )
  const overdueRemindersCount = React.useMemo(
    () => reminders.filter((r) => !r.is_done && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))).length,
    [reminders],
  )
  const announcementCount = criticalStockCount + overdueTasksCount + overdueRemindersCount
  const announcementParts = [
    criticalStockCount > 0 ? `${criticalStockCount} üründe kritik stok` : null,
    overdueTasksCount > 0 ? `${overdueTasksCount} gecikmiş görev` : null,
    overdueRemindersCount > 0 ? `${overdueRemindersCount} gecikmiş hatırlatma` : null,
  ].filter(Boolean)

  const cariTotals = React.useMemo(() => {
    const ledger = computeCariLedger(allPayments, sales, invoices)
    return computeCariTotals(customers, ledger)
  }, [allPayments, sales, invoices, customers])

  const todaysTransactionCount = React.useMemo(
    () =>
      monthPayments.filter((p) => p.paid_at.slice(0, 10) === todayStr).length +
      sales.filter((s) => s.sale_date === todayStr).length,
    [monthPayments, sales, todayStr],
  )

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        {criticalStockCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 }}>
            <Bell size={18} color={theme.colors.warning} />
            <View
              style={{
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                paddingHorizontal: 3,
                backgroundColor: theme.colors.destructive,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.destructiveForeground, fontSize: 10, fontWeight: '700' }}>
                {criticalStockCount}
              </Text>
            </View>
          </View>
        )}
        <Pressable
          onPress={onRefresh}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <RefreshCw size={14} color={theme.colors.foreground} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primary + '26',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.base }}>
            {initials(staff?.full_name || '?')}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
            {greeting()}{staff?.full_name ? `, ${staff.full_name.split(' ')[0]}` : ''}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            {format(new Date(), 'd MMMM yyyy, EEEE', { locale: trLocale })}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('DoktorlarTab', { screen: 'DoctorsList' })}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: theme.colors.primary,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 14,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <PlayCircle size={15} color={theme.colors.primaryForeground} />
          <Text style={{ color: theme.colors.primaryForeground, fontWeight: '700', fontSize: theme.fontSizes.xs }}>
            Ziyarete Başla
          </Text>
        </Pressable>
      </View>

      <PendingSyncBadge />

      {announcementCount > 0 && (
        <Pressable
          onPress={() => (overdueTasksCount > 0 ? navigation.navigate('DigerTab', { screen: 'Tasks' }) : undefined)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.colors.warning + '1a',
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.warning,
            borderRadius: theme.radius.md,
            padding: theme.spacing(3),
          }}
        >
          <Megaphone size={16} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={2}>
            {announcementParts.join(' · ')}
          </Text>
          <View
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              paddingHorizontal: 4,
              backgroundColor: theme.colors.warning,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.background, fontSize: 11, fontWeight: '700' }}>{announcementCount}</Text>
          </View>
        </Pressable>
      )}

      {loading ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <>
          <View>
            <SectionHeader title="Hedeflerim" onPressMore={() => navigation.navigate('DigerTab', { screen: 'Targets' })} />
            <View style={{ gap: 10 }}>
              <GoalCard
                icon={Target}
                title="Tahsilat"
                tags={['Aylık', 'Kurum']}
                value={currency(monthTotal)}
                target={monthTarget != null ? currency(monthTarget) : null}
                ratio={monthTarget != null && monthTarget > 0 ? monthTotal / monthTarget : null}
              />
              {myRep && (
                <GoalCard
                  icon={TrendingUp}
                  title="Kişisel Ciro"
                  tags={['Aylık', 'Kişisel']}
                  value={currency(myMonthCollected)}
                  target={myTarget != null ? currency(myTarget) : null}
                  ratio={myTarget != null && myTarget > 0 ? myMonthCollected / myTarget : null}
                />
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatCard icon={Landmark} label="Toplam Cari" value={currency(cariTotals.totalBalance)} sublabel="Açık bakiye" />
            <StatCard icon={Boxes} label="Ürün Çeşidi" value={products.length.toLocaleString('tr-TR')} sublabel="Aktif" />
            <StatCard
              icon={ShoppingCart}
              label="Bugünkü İşlemler"
              value={todaysTransactionCount.toLocaleString('tr-TR')}
              sublabel="Satış + tahsilat"
            />
          </View>

          <View>
            <SectionHeader
              title="Bugünün Aktiviteleri"
              onPressMore={() => navigation.navigate('DigerTab', { screen: 'DoctorVisits' })}
            />
            <Card style={{ gap: 4, padding: 0 }}>
              {todaysVisits.length === 0 && (
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, padding: theme.spacing(4) }}>
                  Bugün için planlanmış ziyaret yok
                </Text>
              )}
              {todaysVisits.slice(0, 5).map((visit, i) => {
                const timeLabel = visit.check_in_at
                  ? `${format(new Date(visit.check_in_at), 'HH:mm')}${visit.check_out_at ? `–${format(new Date(visit.check_out_at), 'HH:mm')}` : ''}`
                  : null
                const statusLabel = visit.check_out_at ? 'Tamamlandı' : visit.check_in_at ? 'Devam Ediyor' : 'Planlandı'
                return (
                  <View
                    key={visit.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: theme.spacing(3),
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: theme.colors.primary + '1f',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building2 size={15} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                        {visit.doctor_name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                        {timeLabel && <Badge variant="outline">{timeLabel}</Badge>}
                        <Badge variant={visit.check_out_at ? 'success' : visit.check_in_at ? 'default' : 'secondary'}>
                          {statusLabel}
                        </Badge>
                      </View>
                    </View>
                  </View>
                )
              })}
            </Card>
          </View>

          <View>
            <SectionHeader title="Görevlerim" onPressMore={() => navigation.navigate('DigerTab', { screen: 'Tasks' })} />
            <Card style={{ gap: 10 }}>
              {myTasks.length === 0 && (
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
                  Size atanmış açık görev yok
                </Text>
              )}
              {myTasks.slice(0, 6).map((task) => {
                const overdue = task.due_date != null && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                return (
                  <Pressable
                    key={task.id}
                    onPress={() => updateTaskStatus.mutate({ id: task.id, status: 'tamamlandi' })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <Circle size={18} color={theme.colors.mutedForeground} />
                    <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {task.due_date && (
                      <Text
                        style={{
                          color: overdue ? theme.colors.destructive : theme.colors.mutedForeground,
                          fontSize: theme.fontSizes.xs,
                          fontWeight: overdue ? '700' : '400',
                        }}
                      >
                        {format(new Date(task.due_date), 'd MMM', { locale: trLocale })}
                      </Text>
                    )}
                  </Pressable>
                )
              })}
            </Card>
          </View>

          <Pressable
            onPress={() => navigation.navigate('AktivitelerTab')}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Stethoscope size={14} color={theme.colors.mutedForeground} />
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
              Tüm CRM aktivitelerini gör
            </Text>
            <ChevronRight size={14} color={theme.colors.mutedForeground} />
          </Pressable>
        </>
      )}
    </Screen>
  )
}
