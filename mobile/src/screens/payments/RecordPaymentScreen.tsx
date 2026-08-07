import * as React from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ChevronDown } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useCreatePayment } from '@/features/payments/hooks'
import type { PaymentsStackParamList } from '@/navigation/types'
import type { Customer, PaymentMethod } from '@shared/types/database'

type Props = NativeStackScreenProps<PaymentsStackParamList, 'RecordPayment'>

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'nakit', label: 'Nakit' },
  { value: 'kredi_karti', label: 'Kredi Kartı' },
  { value: 'havale', label: 'Havale/EFT' },
  { value: 'pos', label: 'POS' },
]

/** Masaüstündeki PaymentForm.tsx'in Faz 1 alt kümesi (temsilci seçimi yok —
 * offlineInsert yolunu kanıtlamak için minimal ama gerçek bir form). */
export function RecordPaymentScreen({ navigation }: Props) {
  const theme = useTheme()
  const isOnline = useOnlineStatus()
  const createPayment = useCreatePayment()

  const [customer, setCustomer] = React.useState<Customer | null>(null)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState<PaymentMethod>('nakit')
  const [description, setDescription] = React.useState('')

  const amountNum = Number(amount.replace(',', '.'))
  const canSubmit = !!customer && amountNum > 0 && Number.isFinite(amountNum)

  async function handleSubmit() {
    if (!canSubmit || !customer) return
    await createPayment.mutateAsync({
      customer_id: customer.id,
      amount: amountNum,
      payment_method: method,
      description: description.trim() || null,
      paid_at: new Date().toISOString(),
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

        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500' }}>Doktor</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.input,
            }}
          >
            <Text style={{ color: customer ? theme.colors.foreground : theme.colors.mutedForeground }}>
              {customer?.full_name ?? 'Doktor seçin'}
            </Text>
            <ChevronDown size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </View>

        <TextField
          label="Tutar (₺)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
        />

        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500' }}>Ödeme Yöntemi</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {methods.map((m) => (
              <Button
                key={m.value}
                size="sm"
                variant={method === m.value ? 'default' : 'outline'}
                onPress={() => setMethod(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </View>
        </View>

        <TextField label="Açıklama (opsiyonel)" value={description} onChangeText={setDescription} />

        <Button onPress={handleSubmit} disabled={!canSubmit} loading={createPayment.isPending}>
          Tahsilatı Kaydet
        </Button>
      </ScrollView>

      <CustomerPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c)
          setPickerOpen(false)
        }}
      />
    </KeyboardAvoidingView>
  )
}
