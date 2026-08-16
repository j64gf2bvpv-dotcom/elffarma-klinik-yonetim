import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ShoppingCart, Undo2 } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useSales } from '@/features/sales/hooks'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/**
 * Ana sekme çubuğundaki "Siparişler" — kullanıcının pazarlama görselinde
 * istediği yapı (Ana Sayfa/Müşteriler/Siparişler/Daha Fazla). `sales`
 * tablosunda durum (bekleyen/onaylanan/tamamlanan) alanı yok — görseldeki
 * durum rozetleri şu an veri modelinde karşılığı olmayan bir vitrin
 * detayı, bu yüzden burada gösterilmiyor (eklenmek istenirse ayrı bir
 * schema değişikliği gerekir). Satış/iade türü rozetle ayırt ediliyor.
 */
export function OrdersScreen() {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: sales = [], isLoading } = useSales()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['sales'] })
    setRefreshing(false)
  }

  const totalAmount = sales
    .filter((s) => s.type === 'sale')
    .reduce((sum, s) => sum + s.quantity * s.unit_price, 0)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Siparişler" subtitle={`${sales.length} kayıt · ${currency(totalAmount)}`} />
      {isLoading && sales.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Sipariş yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={item.type === 'return' ? Undo2 : ShoppingCart}
              iconColor={item.type === 'return' ? theme.colors.destructive : theme.colors.primary}
              title={item.customers?.full_name ?? 'Bilinmeyen müşteri'}
              subtitle={`${item.product_name} × ${item.quantity} · ${format(new Date(item.sale_date), 'd MMM yyyy', { locale: trLocale })}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.sm }}>
                    {currency(item.quantity * item.unit_price)}
                  </Text>
                  <Badge variant={item.type === 'return' ? 'destructive' : 'success'}>
                    {item.type === 'return' ? 'İade' : 'Satış'}
                  </Badge>
                </View>
              }
            />
          )}
        />
      )}
    </Screen>
  )
}
