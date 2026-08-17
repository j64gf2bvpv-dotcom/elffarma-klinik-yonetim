import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus, Minus, Trash2, Package, Check, ChevronRight, UserRound } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/TextField'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateSale } from '@/features/sales/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { Customer, Product } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'CreateOrder'>
type Step = 1 | 2 | 3

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

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Müşteri' },
  { n: 2, label: 'Ürünler' },
  { n: 3, label: 'Onay' },
]

/**
 * Master talimat §17'deki "Sipariş" ekranı — kullanıcının paylaştığı "Yeni
 * Sipariş" mockup'ına birebir uyacak şekilde (2026-08-17) 3 adımlı sihirbaza
 * çevrildi: Müşteri → Ürünler → Onay. Önceden "+" sekmesine basınca ayrı bir
 * müşteri seçim penceresi açılıp SONRA bu ekrana geliniyordu — artık "+"
 * doğrudan bu ekranı (1. adım boş) açıyor, müşteri seçimi sihirbazın kendi
 * içinde. Doktor Detay'dan "Yeni Sipariş" ile gelindiğinde müşteri zaten
 * dolu gelir ama yine 1. adımdan başlanır (mockup'taki davranış).
 *
 * `sales` şemasında ayrı bir iskonto/KDV sütunu yok (masaüstündeki
 * SaleForm.tsx da aynı düz adet×birim-fiyat modelini kullanıyor). Her satır
 * kaydedilirken hem `sales` tablosuna satır düşer hem de
 * `record_stock_movement` RPC'siyle stok hareketi tetiklenir — CLAUDE.md
 * kuralı gereği current_quantity'ye asla doğrudan yazılmaz.
 */
export function CreateOrderScreen({ route, navigation }: Props) {
  const theme = useTheme()
  const createSale = useCreateSale()
  const recordMovement = useRecordStockMovement()
  const [step, setStep] = React.useState<Step>(1)
  const [customerId, setCustomerId] = React.useState(route.params?.customerId ?? '')
  const [customerName, setCustomerName] = React.useState(route.params?.customerName ?? '')
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false)
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

  function selectCustomer(customer: Customer) {
    setCustomerId(customer.id)
    setCustomerName(customer.full_name)
    setCustomerPickerOpen(false)
  }

  const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0)
  const grandTotal = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0)
  const todayStr = new Date().toISOString().slice(0, 10)

  async function onSubmit() {
    if (!customerId || validLines.length === 0) return
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

  function onPrimaryPress() {
    if (step === 1) {
      if (customerId) setStep(2)
    } else if (step === 2) {
      if (validLines.length > 0) setStep(3)
    } else {
      onSubmit()
    }
  }

  const primaryDisabled = step === 1 ? !customerId : step === 2 ? validLines.length === 0 : submitting
  const primaryLabel = step === 1 || step === 2 ? 'Devam Et' : saleType === 'sale' ? 'Siparişi Kaydet' : 'İadeyi Kaydet'

  return (
    <Screen scroll style={{ gap: 16 }}>
      <ScreenHeader
        title={saleType === 'sale' ? 'Yeni Sipariş' : 'Yeni İade'}
        onBack={step > 1 ? () => setStep((s) => (s - 1) as Step) : undefined}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {STEPS.map((s, i) => {
          const active = s.n === step
          const done = s.n < step
          return (
            <React.Fragment key={s.n}>
              <Pressable
                onPress={() => done && setStep(s.n)}
                disabled={!done}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active || done ? theme.colors.primary : theme.colors.muted,
                  }}
                >
                  {done ? (
                    <Check size={12} color={theme.colors.primaryForeground} />
                  ) : (
                    <Text style={{ color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground, fontSize: 11, fontWeight: '700' }}>
                      {s.n}
                    </Text>
                  )}
                </View>
                <Text
                  style={{
                    color: active ? theme.colors.foreground : theme.colors.mutedForeground,
                    fontSize: theme.fontSizes.xs,
                    fontWeight: active ? '700' : '500',
                  }}
                >
                  {s.label}
                </Text>
              </Pressable>
              {i < STEPS.length - 1 && <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border, marginHorizontal: 8 }} />}
            </React.Fragment>
          )
        })}
      </View>

      {step === 1 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Müşteri</Text>
          <Pressable onPress={() => setCustomerPickerOpen(true)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.primary + '1a',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserRound size={17} color={theme.colors.primary} />
              </View>
              <Text
                style={{ flex: 1, color: customerName ? theme.colors.foreground : theme.colors.mutedForeground, fontWeight: '600' }}
                numberOfLines={1}
              >
                {customerName || 'Müşteri seç...'}
              </Text>
              <ChevronRight size={18} color={theme.colors.mutedForeground} />
            </Card>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setSaleType('sale')} hitSlop={4}>
              <Badge variant={saleType === 'sale' ? 'default' : 'outline'}>Satış</Badge>
            </Pressable>
            <Pressable onPress={() => setSaleType('return')} hitSlop={4}>
              <Badge variant={saleType === 'return' ? 'destructive' : 'outline'}>İade</Badge>
            </Pressable>
          </View>

          <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Ürünler</Text>

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

          <TextField label="Not (Opsiyonel)" value={note} onChangeText={setNote} placeholder="Not eklemek için yazın..." multiline />
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>Onay</Text>
          <Card style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Müşteri</Text>
            <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{customerName}</Text>
          </Card>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
              {saleType === 'sale' ? 'Ürünler (Satış)' : 'Ürünler (İade)'}
            </Text>
            {validLines.map((line) => (
              <View key={line.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.foreground, flex: 1 }} numberOfLines={1}>
                  {line.productName}
                  <Text style={{ color: theme.colors.mutedForeground }}> · {line.quantity} adet</Text>
                </Text>
                <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>
                  {currency(Number(line.quantity) * Number(line.unitPrice))}
                </Text>
              </View>
            ))}
          </Card>
          {note.trim() !== '' && (
            <Card style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Not</Text>
              <Text style={{ color: theme.colors.foreground }}>{note}</Text>
            </Card>
          )}
        </View>
      )}

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Toplam</Text>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg }}>{currency(grandTotal)}</Text>
        </View>
        <Button onPress={onPrimaryPress} loading={submitting} disabled={primaryDisabled} style={{ minWidth: 140 }}>
          {primaryLabel}
        </Button>
      </Card>

      <CustomerPickerModal visible={customerPickerOpen} onClose={() => setCustomerPickerOpen(false)} onSelect={selectCustomer} />
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
