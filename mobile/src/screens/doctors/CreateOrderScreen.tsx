import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus, Minus, Trash2, Package } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/TextField'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateSale } from '@/features/sales/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { Product } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'CreateOrder'>

interface OrderLine {
  key: string
  productId: string
  productName: string
  quantity: string
  unitPrice: string
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function emptyLine(): OrderLine {
  return { key: Math.random().toString(36).slice(2), productId: '', productName: '', quantity: '1', unitPrice: '0' }
}

/**
 * Master talimat §17'deki "Sipariş" ekranı — ürün seç, adet/birim fiyat gir,
 * her satırın ara toplamı ve genel toplam otomatik hesaplanır. `sales`
 * şemasında ayrı bir iskonto/KDV sütunu yok (masaüstündeki SaleForm.tsx da
 * aynı düz adet×birim-fiyat modelini kullanıyor, uydurma bir alan
 * eklenmedi). Her satır kaydedilirken hem `sales` tablosuna satır düşer hem
 * de `record_stock_movement` RPC'siyle stok hareketi tetiklenir —
 * CLAUDE.md kuralı gereği current_quantity'ye asla doğrudan yazılmaz.
 * Satış/İade seçimi masaüstündeki SaleForm.tsx ile aynı mantığı izliyor:
 * satışta stok "out", iadede "in" hareketi düşer (kullanıcı isteğiyle,
 * 2026-08-17 — mobilde önceden sadece satış girilebiliyordu).
 */
export function CreateOrderScreen({ route, navigation }: Props) {
  const { customerId, customerName } = route.params
  const theme = useTheme()
  const createSale = useCreateSale()
  const recordMovement = useRecordStockMovement()
  const [saleType, setSaleType] = React.useState<'sale' | 'return'>('sale')
  const [lines, setLines] = React.useState<OrderLine[]>([emptyLine()])
  const [pickerForLine, setPickerForLine] = React.useState<string | null>(null)
  const [note, setNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  function updateLine(key: string, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev))
  }

  function selectProduct(product: Product) {
    if (!pickerForLine) return
    updateLine(pickerForLine, {
      productId: product.id,
      productName: product.name,
      unitPrice: String(product.unit_price ?? 0),
    })
    setPickerForLine(null)
  }

  const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
  const grandTotal = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0)
  const todayStr = new Date().toISOString().slice(0, 10)

  async function onSubmit() {
    if (validLines.length === 0) return
    setSubmitting(true)
    try {
      for (const line of validLines) {
        const quantity = Number(line.quantity)
        const unitPrice = Number(line.unitPrice)
        await createSale.mutateAsync({
          type: saleType,
          customer_id: customerId,
          product_id: line.productId,
          product_name: line.productName,
          quantity,
          unit_price: unitPrice,
          sale_date: todayStr,
          note: note.trim() || null,
          status: 'bekleyen',
        })
        await recordMovement.mutateAsync({
          product_id: line.productId,
          movement_type: saleType === 'sale' ? 'out' : 'in',
          quantity,
          reason: saleType === 'sale' ? 'Satış' : 'İade',
          customer_id: customerId,
          unit_price: unitPrice,
          note: note.trim() || (saleType === 'sale' ? `${customerName} için sipariş` : `${customerName} tarafından iade edildi`),
        })
      }
      navigation.goBack()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <ScreenHeader title={saleType === 'sale' ? 'Yeni Sipariş' : 'Yeni İade'} subtitle={customerName} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setSaleType('sale')} hitSlop={4}>
          <Badge variant={saleType === 'sale' ? 'default' : 'outline'}>Satış</Badge>
        </Pressable>
        <Pressable onPress={() => setSaleType('return')} hitSlop={4}>
          <Badge variant={saleType === 'return' ? 'destructive' : 'outline'}>İade</Badge>
        </Pressable>
      </View>

      {lines.map((line) => {
        const quantity = Number(line.quantity) || 0
        return (
          <Card key={line.key} style={{ gap: 10 }}>
            <Pressable onPress={() => setPickerForLine(line.key)}>
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
                <Text style={{ color: line.productName ? theme.colors.foreground : theme.colors.mutedForeground, flex: 1 }} numberOfLines={1}>
                  {line.productName || 'Ürün seç...'}
                </Text>
              </View>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <QuantityStepper value={quantity} onChange={(n) => updateLine(line.key, { quantity: String(n) })} />
              <TextField
                label="Birim Fiyat"
                value={line.unitPrice}
                onChangeText={(v) => updateLine(line.key, { unitPrice: v })}
                keyboardType="numeric"
                style={{ width: 120 }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{quantity} adet</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>
                  {currency(quantity * (Number(line.unitPrice) || 0))}
                </Text>
                {lines.length > 1 && (
                  <Pressable onPress={() => removeLine(line.key)} hitSlop={8}>
                    <Trash2 size={16} color={theme.colors.destructive} />
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        )
      })}

      <Button variant="outline" onPress={() => setLines((prev) => [...prev, emptyLine()])}>
        <Plus size={16} color={theme.colors.foreground} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Ürün Ekle</Text>
      </Button>

      <TextField label="Not" value={note} onChangeText={setNote} placeholder="Sipariş ile ilgili not..." multiline />

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>Genel Toplam</Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(grandTotal)}</Text>
      </Card>

      <Button onPress={onSubmit} loading={submitting} disabled={validLines.length === 0}>
        {saleType === 'sale' ? 'Siparişi Kaydet' : 'İadeyi Kaydet'}
      </Button>

      <ProductPickerModal visible={pickerForLine !== null} onClose={() => setPickerForLine(null)} onSelect={selectProduct} />
    </Screen>
  )
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable
        onPress={() => onChange(Math.max(1, value - 1))}
        hitSlop={8}
        style={{
          width: 32,
          height: 32,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Minus size={16} color={theme.colors.foreground} />
      </Pressable>
      <Text style={{ minWidth: 22, textAlign: 'center', color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        hitSlop={8}
        style={{
          width: 32,
          height: 32,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '1a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={16} color={theme.colors.primary} />
      </Pressable>
    </View>
  )
}
