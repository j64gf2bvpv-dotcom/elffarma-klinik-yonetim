import * as React from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { format } from 'date-fns'
import { MapPin, CheckCircle2, Minus, Plus, Package, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import {
  useVisits,
  useStartVisitForCustomer,
  useCheckInVisit,
  useCheckOutVisit,
} from '@/features/doctorVisits/hooks'
import { useRecordStockMovement } from '@/features/stock/hooks'
import { scheduleVisitFollowUpNotification } from '@/features/notifications/localNotifications'
import type { DoctorsStackParamList } from '@/navigation/types'
import type { Product } from '@shared/types/database'

type Props = NativeStackScreenProps<DoctorsStackParamList, 'VisitFlow'>

/**
 * Master talimat §12'deki "Ziyaret / Check-in" akışı — doktor detayından
 * "Ziyaret" butonuna basılınca açılır. GPS konumu expo-location ile alınıp
 * check_in_lat/lng'e yazılır (doctor_visits şemasında zaten mevcut sütunlar,
 * bkz. supabase/schema.sql "check_in_lat/check_in_lng"). Check-in olmadan
 * check-out yapılamaz; check-out sırasında not/konuşulan ürün/sonraki takip
 * tek formda toplanıp tek offlineUpdate çağrısıyla kaydedilir.
 */
export function VisitFlowScreen({ route, navigation }: Props) {
  const { customerId, customerName } = route.params
  const theme = useTheme()
  const { data: visits = [] } = useVisits()
  const startVisit = useStartVisitForCustomer()
  const checkIn = useCheckInVisit()
  const checkOut = useCheckOutVisit()
  const recordMovement = useRecordStockMovement()
  const [locating, setLocating] = React.useState(false)
  const [completing, setCompleting] = React.useState(false)

  const [notes, setNotes] = React.useState('')
  const [discussedProducts, setDiscussedProducts] = React.useState('')
  const [nextVisitDate, setNextVisitDate] = React.useState('')
  const [samples, setSamples] = React.useState<{ product: Product; quantity: number }[]>([])
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const activeVisit = visits.find(
    (v) => v.customer_id === customerId && v.visit_date === todayStr && v.check_in_at && !v.check_out_at,
  )

  async function requestLocation(): Promise<{ lat: number; lng: number } | undefined> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Konum izni gerekli', 'GPS doğrulaması için konum iznini açmanız gerekiyor. İzinsiz check-in konum kaydı olmadan devam eder.')
      return undefined
    }
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      return { lat: position.coords.latitude, lng: position.coords.longitude }
    } catch {
      return undefined
    }
  }

  async function onStart() {
    setLocating(true)
    try {
      const coords = await requestLocation()
      const visit = await startVisit.mutateAsync({ customerId, doctorName: customerName })
      await checkIn.mutateAsync({ id: visit.id, coords })
    } finally {
      setLocating(false)
    }
  }

  function addSample(product: Product) {
    setSamples((prev) => {
      const existing = prev.find((s) => s.product.id === product.id)
      if (existing) return prev.map((s) => (s.product.id === product.id ? { ...s, quantity: s.quantity + 1 } : s))
      return [...prev, { product, quantity: 1 }]
    })
    setPickerOpen(false)
  }

  function changeSampleQty(productId: string, delta: number) {
    setSamples((prev) =>
      prev
        .map((s) => (s.product.id === productId ? { ...s, quantity: s.quantity + delta } : s))
        .filter((s) => s.quantity > 0),
    )
  }

  async function onComplete() {
    if (!activeVisit) return
    setCompleting(true)
    try {
      await checkOut.mutateAsync({
        id: activeVisit.id,
        completion: {
          notes: notes.trim() || null,
          discussed_products: discussedProducts.trim() || null,
          next_visit_date: nextVisitDate || null,
        },
      })
      // Ziyarette doktora verilen numuneler — sipariş ekranındaki (out) satış
      // hareketinden ayrı, 'sample' hareket tipiyle stoktan düşülüyor, aynı
      // record_stock_movement RPC'si üzerinden (CLAUDE.md kuralı korunuyor).
      for (const sample of samples) {
        await recordMovement.mutateAsync({
          product_id: sample.product.id,
          movement_type: 'sample',
          quantity: sample.quantity,
          customer_id: customerId,
          note: `Ziyarette verildi: ${customerName}`,
        })
      }
      if (nextVisitDate) {
        scheduleVisitFollowUpNotification(activeVisit.id, customerName, nextVisitDate)
      }
      navigation.goBack()
    } finally {
      setCompleting(false)
    }
  }

  if (!activeVisit) {
    return (
      <Screen style={{ gap: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: theme.colors.primary + '1a',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPin size={48} color={theme.colors.primary} />
        </View>
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
          {customerName}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
          {locating ? 'Konum doğrulanıyor...' : 'Ziyarete başlamak için konum servisinin açık olduğundan emin olun.'}
        </Text>
        <Button onPress={onStart} loading={locating || startVisit.isPending || checkIn.isPending} style={{ width: '100%' }}>
          Ziyarete Başla
        </Button>
      </Screen>
    )
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <ScreenHeader title="Ziyareti Tamamla" subtitle={customerName} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <CheckCircle2 size={20} color={theme.colors.success} />
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }}>
          Check-in {activeVisit.check_in_at ? new Date(activeVisit.check_in_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''} yapıldı
        </Text>
      </Card>
      <TextField label="Görüşme Notu" value={notes} onChangeText={setNotes} placeholder="Görüşmede konuşulanlar..." multiline />
      <TextField
        label="Konuşulan Ürünler"
        value={discussedProducts}
        onChangeText={setDiscussedProducts}
        placeholder="Örn: Fillicia 200"
      />
      <TextField
        label="Sonraki Takip Tarihi"
        value={nextVisitDate}
        onChangeText={setNextVisitDate}
        placeholder="YYYY-MM-DD"
      />

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>
            Verilen Numuneler
          </Text>
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.xs }}>+ Ürün Ekle</Text>
          </Pressable>
        </View>
        {samples.length === 0 ? (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
            Ziyarette ürün verildiyse ekleyin — check-out'ta stoktan otomatik düşülür.
          </Text>
        ) : (
          <Card style={{ gap: 8 }}>
            {samples.map((s) => (
              <View key={s.product.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Package size={14} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                  {s.product.name}
                </Text>
                <Pressable onPress={() => changeSampleQty(s.product.id, -1)} hitSlop={8} style={{ padding: 4 }}>
                  <Minus size={14} color={theme.colors.foreground} />
                </Pressable>
                <Text style={{ color: theme.colors.foreground, fontWeight: '700', minWidth: 18, textAlign: 'center' }}>
                  {s.quantity}
                </Text>
                <Pressable onPress={() => changeSampleQty(s.product.id, 1)} hitSlop={8} style={{ padding: 4 }}>
                  <Plus size={14} color={theme.colors.foreground} />
                </Pressable>
                <Pressable onPress={() => changeSampleQty(s.product.id, -s.quantity)} hitSlop={8} style={{ padding: 4 }}>
                  <X size={14} color={theme.colors.destructive} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </View>

      <Button onPress={onComplete} loading={completing || checkOut.isPending}>
        Ziyareti Tamamla
      </Button>

      <ProductPickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addSample} />
    </Screen>
  )
}
