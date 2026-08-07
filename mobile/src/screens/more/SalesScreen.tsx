import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, ShoppingCart, TrendingUp, TrendingDown, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useSales, useCreateSale } from '@/features/sales/hooks'
import { useProducts } from '@/features/stock/hooks'
import type { SaleType } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Sales'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function SalesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: sales = [], isLoading } = useSales()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['sales'] })
    setRefreshing(false)
  }

  const totalRevenue = sales.filter(s => s.type === 'sale').reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)
  const totalReturns = sales.filter(s => s.type === 'return').reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Satışlar"
        subtitle={`${sales.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ListItemCard icon={TrendingUp} iconColor={theme.colors.success} title={currency(totalRevenue)} subtitle="Satış" />
        <ListItemCard icon={TrendingDown} iconColor={theme.colors.destructive} title={currency(totalReturns)} subtitle="İade" />
      </View>
      {isLoading && sales.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={item.type === 'return' ? TrendingDown : ShoppingCart}
              iconColor={item.type === 'return' ? theme.colors.destructive : theme.colors.primary}
              title={item.product_name}
              subtitle={`${item.customers?.full_name ?? '—'} · ${format(new Date(item.sale_date), 'd MMM yyyy', { locale: trLocale })}`}
              right={
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(Number(item.quantity) * Number(item.unit_price))}</Text>
                  <Badge variant={item.type === 'return' ? 'destructive' : 'secondary'}>
                    {item.type === 'return' ? 'İade' : 'Satış'} · {item.quantity} ad
                  </Badge>
                </View>
              }
            />
          )}
        />
      )}
      <AddSaleModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddSaleModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateSale()
  const { data: products = [] } = useProducts('')
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [productName, setProductName] = React.useState('')
  const [quantity, setQuantity] = React.useState('1')
  const [unitPrice, setUnitPrice] = React.useState('')
  const [type, setType] = React.useState<SaleType>('sale')

  async function onSave() {
    if (!customerId || !productName.trim() || !quantity || !unitPrice) return
    await createMutation.mutateAsync({
      type,
      customer_id: customerId,
      product_name: productName.trim(),
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      sale_date: format(new Date(), 'yyyy-MM-dd'),
    })
    setCustomerId(''); setCustomerName(''); setProductName(''); setQuantity('1'); setUnitPrice(''); setType('sale')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Satış</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => setShowCustomerPicker(true)}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500', marginBottom: 4 }}>Doktor *</Text>
            <View style={{ height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: theme.colors.input }}>
              <Text style={{ color: customerName ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {customerName || 'Doktor seç...'}
              </Text>
            </View>
          </Pressable>
          <TextField label="Ürün Adı *" value={productName} onChangeText={setProductName} placeholder="Ürün adı" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Adet *" value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={{ flex: 1 }} />
            <TextField label="Birim Fiyat *" value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant={type === 'sale' ? 'default' : 'outline'} size="sm" onPress={() => setType('sale')} style={{ flex: 1 }}>
              Satış
            </Button>
            <Button variant={type === 'return' ? 'destructive' : 'outline'} size="sm" onPress={() => setType('return')} style={{ flex: 1 }}>
              İade
            </Button>
          </View>
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!customerId || !productName.trim()}>
            Kaydet
          </Button>
        </View>
        <CustomerPickerModal
          visible={showCustomerPicker}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(c) => {
            setCustomerId(c.id)
            setCustomerName(c.full_name)
            setShowCustomerPicker(false)
          }}
        />
      </Screen>
    </Modal>
  )
}
