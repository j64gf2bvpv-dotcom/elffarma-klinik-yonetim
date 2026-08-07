import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { usePayments } from '@/features/payments/hooks'
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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700' }}>Tahsilatlar</Text>
        <Button size="sm" onPress={() => navigation.navigate('RecordPayment')}>
          <Plus size={16} color={theme.colors.primaryForeground} />
          <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Ekle</Text>
        </Button>
      </View>
      <PendingSyncBadge />
      {isLoading && payments.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>
                  {item.customers?.full_name ?? '—'}
                </Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                  {methodLabels[item.payment_method] ?? item.payment_method} ·{' '}
                  {format(new Date(item.paid_at), 'd MMM yyyy', { locale: trLocale })}
                </Text>
              </View>
              <Text style={{ color: theme.colors.success, fontWeight: '700' }}>{currency(Number(item.amount))}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  )
}
