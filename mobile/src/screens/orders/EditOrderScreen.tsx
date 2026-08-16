import * as React from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { Package, Trash2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/TextField'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useSales, useUpdateSale, useDeleteSale } from '@/features/sales/hooks'
import { SALE_STATUS_LABEL, SALE_STATUS_BADGE_VARIANT } from '@/features/sales/status'
import { useRecordStockMovement } from '@/features/stock/hooks'
import type { OrdersStackParamList } from '@/navigation/types'
import type { Product, SaleStatus } from '@shared/types/database'

type Props = NativeStackScreenProps<OrdersStackParamList, 'EditOrder'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

const STATUS_OPTIONS: SaleStatus[] = ['bekleyen', 'onaylandi', 'tamamlandi']

/** Satış/iade tipini stok üzerindeki işaretli etkiye çevirir — satış stoktan
 * düşer (negatif), iade stoğa geri döner (pozitif). CreateOrderScreen'deki
 * movement_type eşlemesiyle aynı mantık (bkz. o dosyadaki not). */
function signedEffect(type: 'sale' | 'return', quantity: number) {
  return type === 'sale' ? -quantity : quantity
}

/**
 * Siparişler listesindeki bir kaydı düzenleme/silme ekranı — kullanıcı
 * isteğiyle (2026-08-17), önceden liste salt okunurdu. `sales` satırını
 * güncellerken stok da tutarlı kalmalı: CLAUDE.md kuralı gereği
 * current_quantity'ye asla doğrudan yazılmıyor, bunun yerine eski/yeni
 * durum arasındaki farkı telafi eden bir `record_stock_movement` düzeltme
 * hareketi düşülüyor (ürün değişmediyse net fark, değiştiyse eski ürüne
 * tam ters + yeni ürüne tam hareket) — geçmiş hareketler asla silinmiyor,
 * sadece ek bir düzeltme kaydı ekleniyor (masaüstündeki audit-trail
 * felsefesiyle aynı).
 */
export function EditOrderScreen({ route, navigation }: Props) {
  const { saleId } = route.params
  const theme = useTheme()
  const { data: sales = [] } = useSales()
  const sale = sales.find((s) => s.id === saleId)
  const updateSale = useUpdateSale()
  const deleteSale = useDeleteSale()
  const recordMovement = useRecordStockMovement()

  const [type, setType] = React.useState<'sale' | 'return'>(sale?.type ?? 'sale')
  const [status, setStatus] = React.useState<SaleStatus>(sale?.status ?? 'bekleyen')
  const [productId, setProductId] = React.useState(sale?.product_id ?? '')
  const [productName, setProductName] = React.useState(sale?.product_name ?? '')
  const [quantity, setQuantity] = React.useState(String(sale?.quantity ?? 1))
  const [unitPrice, setUnitPrice] = React.useState(String(sale?.unit_price ?? 0))
  const [note, setNote] = React.useState(sale?.note ?? '')
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  function selectProduct(product: Product) {
    setProductId(product.id)
    setProductName(product.name)
    setUnitPrice(String(product.unit_price ?? 0))
    setPickerOpen(false)
  }

  if (!sale) {
    return (
      <Screen>
        <ScreenHeader title="Sipariş" />
        <Text style={{ color: theme.colors.mutedForeground }}>Kayıt bulunamadı.</Text>
      </Screen>
    )
  }

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0)

  async function onSave() {
    const newQuantity = Number(quantity)
    const newUnitPrice = Number(unitPrice)
    if (!productId || newQuantity <= 0) return
    setSubmitting(true)
    try {
      await updateSale.mutateAsync({
        id: saleId,
        patch: {
          type,
          status,
          product_id: productId,
          product_name: productName,
          quantity: newQuantity,
          unit_price: newUnitPrice,
          note: note.trim() || null,
        },
      })

      const oldProductId = sale!.product_id
      const oldEffect = oldProductId ? signedEffect(sale!.type, sale!.quantity) : 0
      const newEffect = signedEffect(type, newQuantity)

      if (oldProductId && oldProductId === productId) {
        const delta = newEffect - oldEffect
        if (delta !== 0) {
          await recordMovement.mutateAsync({
            product_id: productId,
            movement_type: delta > 0 ? 'in' : 'out',
            quantity: Math.abs(delta),
            reason: 'Sipariş düzenleme',
            customer_id: sale!.customer_id,
            unit_price: newUnitPrice,
            note: 'Sipariş düzenlendi — stok farkı düzeltmesi',
          })
        }
      } else {
        if (oldProductId) {
          await recordMovement.mutateAsync({
            product_id: oldProductId,
            movement_type: sale!.type === 'sale' ? 'in' : 'out',
            quantity: sale!.quantity,
            reason: 'Sipariş düzenleme',
            customer_id: sale!.customer_id,
            unit_price: sale!.unit_price,
            note: 'Sipariş düzenlendi — eski ürün hareketi iptal edildi',
          })
        }
        await recordMovement.mutateAsync({
          product_id: productId,
          movement_type: type === 'sale' ? 'out' : 'in',
          quantity: newQuantity,
          reason: 'Sipariş düzenleme',
          customer_id: sale!.customer_id,
          unit_price: newUnitPrice,
          note: 'Sipariş düzenlendi — yeni ürün hareketi',
        })
      }

      navigation.goBack()
    } finally {
      setSubmitting(false)
    }
  }

  function onDelete() {
    Alert.alert('Siparişi Sil', 'Bu kayıt silinsin mi? Stok geri alınacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true)
          try {
            if (sale!.product_id) {
              await recordMovement.mutateAsync({
                product_id: sale!.product_id,
                movement_type: sale!.type === 'sale' ? 'in' : 'out',
                quantity: sale!.quantity,
                reason: 'Sipariş silindi',
                customer_id: sale!.customer_id,
                unit_price: sale!.unit_price,
                note: 'Sipariş silindi — stok geri alındı',
              })
            }
            await deleteSale.mutateAsync(saleId)
            navigation.goBack()
          } finally {
            setSubmitting(false)
          }
        },
      },
    ])
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <ScreenHeader title={type === 'sale' ? 'Siparişi Düzenle' : 'İadeyi Düzenle'} subtitle={sale.customers?.full_name} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setType('sale')} hitSlop={4}>
          <Badge variant={type === 'sale' ? 'default' : 'outline'}>Satış</Badge>
        </Pressable>
        <Pressable onPress={() => setType('return')} hitSlop={4}>
          <Badge variant={type === 'return' ? 'destructive' : 'outline'}>İade</Badge>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {STATUS_OPTIONS.map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} hitSlop={4}>
            <Badge variant={status === s ? SALE_STATUS_BADGE_VARIANT[s] : 'outline'}>{SALE_STATUS_LABEL[s]}</Badge>
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: 10 }}>
        <Pressable onPress={() => setPickerOpen(true)}>
          <View
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.colors.input,
            }}
          >
            <Package size={16} color={theme.colors.mutedForeground} />
            <Text style={{ color: productName ? theme.colors.foreground : theme.colors.mutedForeground, flex: 1 }} numberOfLines={1}>
              {productName || 'Ürün seç...'}
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextField label="Adet" value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={{ flex: 1 }} />
          <TextField label="Birim Fiyat" value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" style={{ flex: 1 }} />
        </View>
      </Card>

      <TextField label="Not" value={note ?? ''} onChangeText={setNote} placeholder="Sipariş ile ilgili not..." multiline />

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>Toplam</Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(total)}</Text>
      </Card>

      <Button onPress={onSave} loading={submitting} disabled={!productId || Number(quantity) <= 0}>
        Kaydet
      </Button>

      <Button variant="outline" onPress={onDelete} disabled={submitting}>
        <Trash2 size={16} color={theme.colors.destructive} />
        <Text style={{ color: theme.colors.destructive, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Siparişi Sil</Text>
      </Button>

      <ProductPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectProduct} />
    </Screen>
  )
}
