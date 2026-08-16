import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus, Trash2, Package } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateQuote } from '@/features/quotes/hooks'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { Product } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'CreateQuote'>

interface QuoteLine {
  key: string
  productId: string
  productName: string
  quantity: string
  unitPrice: string
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function emptyLine(): QuoteLine {
  return { key: Math.random().toString(36).slice(2), productId: '', productName: '', quantity: '1', unitPrice: '0' }
}

/**
 * Master talimat §20'deki Teklif ekranı — Sipariş ekranıyla aynı çoklo ürün
 * satırı deseni, farkı: quotes/quote_items tablolarına yazıyor (sales'e
 * dokunmuyor, stok hareketi tetiklemiyor — bir teklif henüz gerçekleşmiş
 * bir satış değil) ve iskonto/KDV oranı giriliyor.
 */
export function CreateQuoteScreen({ route, navigation }: Props) {
  const { customerId, customerName } = route.params
  const theme = useTheme()
  const createQuote = useCreateQuote()
  const [lines, setLines] = React.useState<QuoteLine[]>([emptyLine()])
  const [pickerForLine, setPickerForLine] = React.useState<string | null>(null)
  const [discountRate, setDiscountRate] = React.useState('0')
  const [vatRate, setVatRate] = React.useState('20')
  const [validUntil, setValidUntil] = React.useState('')
  const [note, setNote] = React.useState('')

  function updateLine(key: string, patch: Partial<QuoteLine>) {
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
  const subtotal = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0)
  const discountAmount = subtotal * (Number(discountRate) / 100)
  const afterDiscount = subtotal - discountAmount
  const vatAmount = afterDiscount * (Number(vatRate) / 100)
  const grandTotal = afterDiscount + vatAmount

  async function onSubmit() {
    if (validLines.length === 0) return
    await createQuote.mutateAsync({
      customer_id: customerId,
      valid_until: validUntil || null,
      note: note.trim() || null,
      discount_rate: Number(discountRate) || 0,
      vat_rate: Number(vatRate) || 0,
      items: validLines.map((l) => ({
        product_id: l.productId,
        product_name: l.productName,
        quantity: Number(l.quantity),
        unit_price: Number(l.unitPrice),
      })),
    })
    navigation.goBack()
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <ScreenHeader title="Yeni Teklif" subtitle={customerName} />

      {lines.map((line) => (
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField
              label="Adet"
              value={line.quantity}
              onChangeText={(v) => updateLine(line.key, { quantity: v })}
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <TextField
              label="Birim Fiyat"
              value={line.unitPrice}
              onChangeText={(v) => updateLine(line.key, { unitPrice: v })}
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Ara Toplam</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>
                {currency((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}
              </Text>
              {lines.length > 1 && (
                <Pressable onPress={() => removeLine(line.key)} hitSlop={8}>
                  <Trash2 size={16} color={theme.colors.destructive} />
                </Pressable>
              )}
            </View>
          </View>
        </Card>
      ))}

      <Button variant="outline" onPress={() => setLines((prev) => [...prev, emptyLine()])}>
        <Plus size={16} color={theme.colors.foreground} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Ürün Ekle</Text>
      </Button>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextField label="İskonto (%)" value={discountRate} onChangeText={setDiscountRate} keyboardType="numeric" style={{ flex: 1 }} />
        <TextField label="KDV (%)" value={vatRate} onChangeText={setVatRate} keyboardType="numeric" style={{ flex: 1 }} />
      </View>
      <TextField label="Geçerlilik Tarihi" value={validUntil} onChangeText={setValidUntil} placeholder="YYYY-MM-DD" />
      <TextField label="Not" value={note} onChangeText={setNote} placeholder="Detay..." multiline />

      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>Ara Toplam</Text>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm }}>{currency(subtotal)}</Text>
        </View>
        {Number(discountRate) > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>İskonto (%{discountRate})</Text>
            <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.sm }}>-{currency(discountAmount)}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>KDV (%{vatRate})</Text>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm }}>{currency(vatAmount)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>Genel Toplam</Text>
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(grandTotal)}</Text>
        </View>
      </Card>

      <Button onPress={onSubmit} loading={createQuote.isPending} disabled={validLines.length === 0}>
        Teklifi Kaydet
      </Button>

      <ProductPickerModal visible={pickerForLine !== null} onClose={() => setPickerForLine(null)} onSelect={selectProduct} />
    </Screen>
  )
}
