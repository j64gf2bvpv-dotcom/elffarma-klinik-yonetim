import * as React from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { useProducts } from '@/features/stock/hooks'
import type { Product } from '@shared/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function ProductPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (product: Product) => void
}) {
  const theme = useTheme()
  const [search, setSearch] = React.useState('')
  const { data: products = [], isLoading } = useProducts(search)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
            Ürün Seç
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <TextField
          placeholder="Ara (ürün adı)..."
          value={search}
          onChangeText={setSearch}
          containerStyle={{ marginBottom: 12 }}
          autoFocus
        />
        {isLoading && products.length === 0 ? (
          <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Sonuç yok</Text>}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                    Stok: {item.current_quantity} {item.unit}
                  </Text>
                </View>
                {item.unit_price != null && (
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{currency(item.unit_price)}</Text>
                )}
              </Pressable>
            )}
          />
        )}
      </Screen>
    </Modal>
  )
}
