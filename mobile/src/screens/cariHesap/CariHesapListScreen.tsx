import * as React from 'react'
import { FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native'
import { Building2, Phone, Mail } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
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
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Cari Hesap" subtitle={`${rows.length} doktor/cari`} />
      <PendingSyncBadge />
      <TextField
        placeholder="Ara (ad, telefon)..."
        value={search}
        onChangeText={setSearch}
        containerStyle={{ marginBottom: 2 }}
      />
      {isLoading && rows.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.customer.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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

function QuickActionButton({ icon: Icon, onPress }: { icon: typeof Phone; onPress: () => void }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon size={13} color={theme.colors.foreground} />
    </Pressable>
  )
}

function CariRow({ customer, balance, onPress }: { customer: Customer; balance: number; onPress: () => void }) {
  const theme = useTheme()
  return (
    <ListItemCard
      icon={Building2}
      iconColor={balance > 0 ? theme.colors.destructive : theme.colors.primary}
      title={customer.full_name}
      subtitle={customer.hospital_name ?? undefined}
      onPress={onPress}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <QuickActionButton icon={Phone} onPress={() => Linking.openURL(`tel:${customer.phone}`)} />
          {customer.email && (
            <QuickActionButton icon={Mail} onPress={() => Linking.openURL(`mailto:${customer.email}`)} />
          )}
          <Badge variant={balance > 0 ? 'destructive' : 'secondary'}>{currency(balance)}</Badge>
        </View>
      }
    />
  )
}
