import * as React from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { computeCariLedger } from '@shared/businessLogic/cariLedger'
import type { CariHesapStackParamList } from '@/navigation/types'
import type { Customer } from '@shared/types/database'

type Props = NativeStackScreenProps<CariHesapStackParamList, 'CariHesapList'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/** Masaüstündeki CariHesapListPage.tsx'in mobil karşılığı — aynı bakiye
 * hesaplaması (computeCariLedger, shared/), bakiyeye göre azalan sıralama. */
export function CariHesapListScreen({ navigation }: Props) {
  const theme = useTheme()
  const [search, setSearch] = React.useState('')
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: customers = [], isLoading } = useCustomers(search)
  const { data: allPayments = [] } = usePayments({})
  const { data: allSales = [] } = useSales()
  const { data: allInvoices = [] } = useInvoices()

  const ledger = React.useMemo(
    () => computeCariLedger(allPayments, allSales, allInvoices),
    [allPayments, allSales, allInvoices],
  )

  const rows = React.useMemo(
    () =>
      customers
        .map((c) => {
          const entry = ledger.get(c.id) ?? { debit: 0, credit: 0 }
          return { customer: c, balance: entry.debit - entry.credit }
        })
        .sort((a, b) => b.balance - a.balance),
    [customers, ledger],
  )

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <Screen>
      <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xl, fontWeight: '700', marginBottom: 12 }}>
        Cari Hesap
      </Text>
      <PendingSyncBadge />
      <TextField
        placeholder="Ara (ad, telefon)..."
        value={search}
        onChangeText={setSearch}
        containerStyle={{ marginBottom: 12 }}
      />
      {isLoading && rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.customer.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
          renderItem={({ item }) => (
            <CariRow
              customer={item.customer}
              balance={item.balance}
              onPress={() =>
                navigation.navigate('CariHesapDetail', { customerId: item.customer.id, customerName: item.customer.full_name })
              }
            />
          )}
        />
      )}
    </Screen>
  )
}

function CariRow({ customer, balance, onPress }: { customer: Customer; balance: number; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{customer.full_name}</Text>
        {customer.hospital_name && (
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{customer.hospital_name}</Text>
        )}
      </View>
      <Badge variant={balance > 0 ? 'destructive' : 'secondary'}>{currency(balance)}</Badge>
      <ChevronRight size={18} color={theme.colors.mutedForeground} />
    </Pressable>
  )
}
