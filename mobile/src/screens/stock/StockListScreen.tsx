import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { Boxes } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useProducts } from '@/features/stock/hooks'
import type { StockStackParamList } from '@/navigation/types'
import type { Product } from '@shared/types/database'

type Props = NativeStackScreenProps<StockStackParamList, 'StockList'>

/** Masaüstündeki StockPage.tsx'in Faz 1 alt kümesi — ürün listesi + hareket
 * kaydetme (RPC), ürün oluşturma/düzenleme Faz 2+'da. */
export function StockListScreen({ navigation }: Props) {
  const theme = useTheme()
  const [search, setSearch] = React.useState('')
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: products = [], isLoading } = useProducts(search)

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['products'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Stok" subtitle={`${products.length} ürün`} />
      <PendingSyncBadge />
      <TextField
        placeholder="Ürün ara..."
        value={search}
        onChangeText={setSearch}
        containerStyle={{ marginBottom: 2 }}
      />
      {isLoading && products.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Ürün yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onPress={() =>
                navigation.navigate('RecordMovement', {
                  productId: item.id,
                  productName: item.name,
                  currentQuantity: item.current_quantity,
                  unit: item.unit,
                })
              }
            />
          )}
        />
      )}
    </Screen>
  )
}

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const theme = useTheme()
  const critical = product.current_quantity <= product.critical_stock_threshold
  return (
    <ListItemCard
      icon={Boxes}
      iconColor={critical ? theme.colors.destructive : theme.colors.primary}
      title={product.name}
      subtitle={product.sku ? `Kod: ${product.sku}` : undefined}
      onPress={onPress}
      right={
        <Badge variant={critical ? 'destructive' : 'secondary'}>
          {product.current_quantity} {product.unit}
        </Badge>
      }
    />
  )
}
