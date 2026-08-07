import * as React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast, isToday, startOfMonth } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import {
  ShoppingCart,
  Landmark,
  Boxes,
  AlertTriangle,
  Bell,
  RefreshCw,
  Circle,
  Target,
} from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
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
import { computeCariLedger, computeCariTotals } from '@shared/businessLogic/cariLedger'

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

/**
 * gocust'un mobil CRM tanıtım sayfasındaki Dashboard yerleşiminden (karşılama
 * başlığı, duyuru/uyarı banner'ı, ilerleme çubuklu hedef kartı, günün
 * işlemleri, görev listesi) ilham alınarak Elffarma marka renkleriyle ve
 * gerçek veriyle yeniden kurulmuş hâli — hiçbir sayı/metin uydurulmadı,
 * hedef yoksa ilerleme çubuğu yerine düz rakam gösterilir.
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
  const { data: monthTarget } = useCurrentMonthTarget()
  const { data: myTasks = [] } = useMyTasks()
  const updateTaskStatus = useUpdateTaskStatus()

  const monthStart = React.useMemo(() => startOfMonth(new Date()), [])
  const monthPayments = React.useMemo(
    () => allPayments.filter((p) => new Date(p.paid_at) >= monthStart),
    [allPayments, monthStart],
  )
  const monthTotal = React.useMemo(
    () => monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    [monthPayments],
  )
  const criticalStockCount = React.useMemo(
    () => products.filter((p) => p.current_quantity <= p.critical_stock_threshold).length,
    [products],
  )
  const cariTotals = React.useMemo(() => {
    const ledger = computeCariLedger(allPayments, sales, invoices)
    return computeCariTotals(customers, ledger)
  }, [allPayments, sales, invoices, customers])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {criticalStockCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
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
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <RefreshCw size={16} color={theme.colors.foreground} />
          </Pressable>
        </View>
      </View>

      <PendingSyncBadge />

      {criticalStockCount > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.colors.warning + '22',
            borderRadius: theme.radius.md,
            padding: theme.spacing(3),
          }}
        >
          <AlertTriangle size={16} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }}>
            {criticalStockCount} üründe kritik stok seviyesi
          </Text>
        </View>
      )}

      {loading ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <>
          <View>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontSize: theme.fontSizes.sm,
                fontWeight: '600',
                marginBottom: 8,
              }}
            >
              Aylık Hedef
            </Text>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={16} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Tahsilat</Text>
                <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(monthTotal)}</Text>
                {monthTarget != null && (
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                    / {currency(monthTarget)}
                  </Text>
                )}
              </View>
              {monthTarget != null && monthTarget > 0 ? (
                <ProgressBar ratio={monthTotal / monthTarget} />
              ) : (
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                  Bu ay için hedef belirlenmemiş
                </Text>
              )}
            </Card>
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
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontSize: theme.fontSizes.sm,
                fontWeight: '600',
                marginBottom: 8,
              }}
            >
              Görevlerim
            </Text>
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
        </>
      )}

      <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
        <Text onPress={signOut} style={{ color: theme.colors.destructive, fontWeight: '600' }}>
          Çıkış Yap
        </Text>
      </View>
    </Screen>
  )
}
