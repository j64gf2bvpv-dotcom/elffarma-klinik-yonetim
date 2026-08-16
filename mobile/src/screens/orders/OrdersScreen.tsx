import * as React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useTheme } from '@/lib/ThemeContext'
import { useSales } from '@/features/sales/hooks'
import type { SaleWithCustomer } from '@/features/sales/api'
import { SALE_STATUS_LABEL, SALE_STATUS_BADGE_VARIANT } from '@/features/sales/status'
import type { OrdersStackParamList } from '@/navigation/types'
import type { SaleStatus } from '@shared/types/database'

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrdersList'>

type StatusFilter = 'all' | SaleStatus

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Ana sekme çubuğundaki "Siparişler" — kullanıcının pazarlama görselinde
 * istediği yapı (Ana Sayfa/Müşteriler/Siparişler/Daha Fazla). Kullanıcı
 * isteğiyle (2026-08-17) Bekleyen/Onaylandı/Tamamlandı durum akışı eklendi
 * (bkz. supabase/migrations/20260816235118_add_status_to_sales.sql —
 * önceden bu görselin durum rozetlerinin şemada karşılığı yoktu).
 * Satırlar tıklanabilir — EditOrderScreen'e gidip mevcut kaydı
 * düzenleyip/silebiliyor, durumu değiştirebiliyor.
 */
export function OrdersScreen({ navigation }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const { data: sales = [], isLoading } = useSales()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['sales'] })
    setRefreshing(false)
  }

  const totalAmount = sales
    .filter((s) => s.type === 'sale')
    .reduce((sum, s) => sum + s.quantity * s.unit_price, 0)

  const counts = React.useMemo(() => {
    const c: Record<StatusFilter, number> = { all: sales.length, bekleyen: 0, onaylandi: 0, tamamlandi: 0 }
    for (const s of sales) c[s.status]++
    return c
  }, [sales])

  const filteredSales = statusFilter === 'all' ? sales : sales.filter((s) => s.status === statusFilter)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Siparişler" subtitle={`${sales.length} kayıt · ${currency(totalAmount)}`} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['all', `Tümü (${counts.all})`],
            ['bekleyen', `Bekleyen (${counts.bekleyen})`],
            ['onaylandi', `Onaylandı (${counts.onaylandi})`],
            ['tamamlandi', `Tamamlandı (${counts.tamamlandi})`],
          ] as [StatusFilter, string][]
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setStatusFilter(key)} hitSlop={4}>
            <Badge variant={statusFilter === key ? 'default' : 'outline'}>{label}</Badge>
          </Pressable>
        ))}
      </View>
      {isLoading && sales.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(s) => s.id}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Sipariş yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <OrderRow item={item} onPress={() => navigation.navigate('EditOrder', { saleId: item.id })} />}
        />
      )}
    </Screen>
  )
}

function OrderRow({ item, onPress }: { item: SaleWithCustomer; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }} numberOfLines={1}>
            {item.customers?.full_name ?? 'Bilinmeyen müşteri'}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            {format(new Date(item.created_at), 'd MMMM yyyy, HH:mm', { locale: trLocale })}
          </Text>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
            {currency(item.quantity * item.unit_price)}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            {item.quantity} adet · {item.product_name}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge variant={SALE_STATUS_BADGE_VARIANT[item.status]}>{SALE_STATUS_LABEL[item.status]}</Badge>
          {item.type === 'return' && <Badge variant="outline">İade</Badge>}
        </View>
      </Card>
    </Pressable>
  )
}
