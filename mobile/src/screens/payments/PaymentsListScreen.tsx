import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Banknote, CreditCard, Landmark, Smartphone, type LucideIcon } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { usePayments } from '@/features/payments/hooks'
import type { PaymentWithCustomer } from '@/features/payments/api'
import type { PaymentsStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<PaymentsStackParamList, 'PaymentsList'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

const methodLabels: Record<string, string> = {
  nakit: 'Nakit',
  kredi_karti: 'Kredi Kartı',
  havale: 'Havale/EFT',
  pos: 'POS',
}

const methodIcons: Record<string, LucideIcon> = {
  nakit: Banknote,
  kredi_karti: CreditCard,
  havale: Landmark,
  pos: Smartphone,
}

/** Masaüstündeki PaymentsPage.tsx'in Faz 1 alt kümesi — liste + tahsilat
 * kaydetme (offlineInsert kanıtı), taksit planı/fatura eki Faz 2+'da. */
export function PaymentsListScreen({ navigation }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: payments = [], isLoading } = usePayments({})

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['payments'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Tahsilatlar"
        subtitle={`${payments.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => navigation.navigate('RecordPayment')}>
            <Plus size={16} color={theme.colors.primaryForeground} />
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Ekle</Text>
          </Button>
        }
      />
      <PendingSyncBadge />
      {isLoading && payments.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <PaymentRow payment={item} />}
        />
      )}
    </Screen>
  )
}

function PaymentRow({ payment }: { payment: PaymentWithCustomer }) {
  const theme = useTheme()
  const Icon = methodIcons[payment.payment_method] ?? Banknote
  return (
    <ListItemCard
      icon={Icon}
      iconColor={theme.colors.success}
      title={payment.customers?.full_name ?? '—'}
      subtitle={`${methodLabels[payment.payment_method] ?? payment.payment_method} · ${format(new Date(payment.paid_at), 'd MMM yyyy', { locale: trLocale })}`}
      right={
        <Text style={{ color: theme.colors.success, fontWeight: '700' }}>{currency(Number(payment.amount))}</Text>
      }
    />
  )
}
