import * as React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
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
    <Screen>
      <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700', marginBottom: 12 }}>
        Stok
      </Text>
      <PendingSyncBadge />
      <TextField
        placeholder="Ürün ara..."
        value={search}
        onChangeText={setSearch}
        containerStyle={{ marginBottom: 12 }}
      />
      {isLoading && products.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Ürün yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{product.name}</Text>
        {product.sku && (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Kod: {product.sku}</Text>
        )}
      </View>
      <Badge variant={critical ? 'destructive' : 'secondary'}>
        {product.current_quantity} {product.unit}
      </Badge>
      <ChevronRight size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  )
}
