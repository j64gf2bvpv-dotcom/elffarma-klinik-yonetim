import * as React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Card } from '@/components/ui/Card'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useRecordStockMovement } from '@/features/stock/hooks'
import type { StockStackParamList } from '@/navigation/types'
import type { MovementType } from '@shared/types/database'

type Props = NativeStackScreenProps<StockStackParamList, 'RecordMovement'>

/**
 * CLAUDE.md kuralı: current_quantity'ye asla doğrudan yazılmaz, her zaman
 * record_stock_movement RPC'si üzerinden — offline olsa bile (offlineRpc
 * kuyruğa alır, bağlantı gelince RPC gerçek Supabase'de çalışır ve miktarı
 * SUNUCU tarafında hesaplar; buradaki iyimser +/- sadece ekranın anında
 * güncellenmesi için, otoriter değer değil). Bu ekran Faz 1'in mimari kanıtı:
 * hem online hem uçak modunda (offline kuyruk) test edilmeli.
 */
export function RecordMovementScreen({ route, navigation }: Props) {
  const { productId, productName, currentQuantity, unit } = route.params
  const theme = useTheme()
  const isOnline = useOnlineStatus()
  const recordMovement = useRecordStockMovement()

  const [direction, setDirection] = React.useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = React.useState('')
  const [reason, setReason] = React.useState('')

  React.useLayoutEffect(() => navigation.setOptions({ title: productName }), [navigation, productName])

  const qty = Number(quantity)
  const canSubmit = qty > 0 && Number.isFinite(qty)

  async function handleSubmit() {
    if (!canSubmit) return
    const movement_type: MovementType = direction
    await recordMovement.mutateAsync({
      product_id: productId,
      movement_type,
      quantity: qty,
      reason: reason.trim() || null,
    })
    navigation.goBack()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {!isOnline && (
          <View style={{ backgroundColor: theme.colors.warning, borderRadius: theme.radius.md, padding: 10 }}>
            <Text style={{ color: theme.colors.warningForeground, fontWeight: '600' }}>
              Bağlantı yok — kayıt kuyruğa alınacak, bağlantı gelince otomatik gönderilecek.
            </Text>
          </View>
        )}

        <Card>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Mevcut Stok</Text>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xxl, fontWeight: '700' }}>
            {currentQuantity} {unit}
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            variant={direction === 'in' ? 'default' : 'outline'}
            onPress={() => setDirection('in')}
            style={{ flex: 1 }}
          >
            <ArrowDownCircle size={16} color={direction === 'in' ? theme.colors.primaryForeground : theme.colors.foreground} />
            <Text style={{ color: direction === 'in' ? theme.colors.primaryForeground : theme.colors.foreground, fontWeight: '600' }}>
              Giriş
            </Text>
          </Button>
          <Button
            variant={direction === 'out' ? 'destructive' : 'outline'}
            onPress={() => setDirection('out')}
            style={{ flex: 1 }}
          >
            <ArrowUpCircle size={16} color={direction === 'out' ? theme.colors.destructiveForeground : theme.colors.foreground} />
            <Text style={{ color: direction === 'out' ? theme.colors.destructiveForeground : theme.colors.foreground, fontWeight: '600' }}>
              Çıkış
            </Text>
          </Button>
        </View>

        <TextField
          label={`Adet (${unit})`}
          value={quantity}
          onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="0"
        />
        <TextField label="Sebep (opsiyonel)" value={reason} onChangeText={setReason} placeholder="ör. Sayım düzeltmesi" />

        <Button onPress={handleSubmit} disabled={!canSubmit} loading={recordMovement.isPending}>
          {direction === 'in' ? 'Girişi Kaydet' : 'Çıkışı Kaydet'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
