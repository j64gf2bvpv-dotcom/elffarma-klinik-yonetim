import * as React from 'react'
import { FlatList, Linking, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { Building2, Phone, Mail, Plus, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { PendingSyncBadge } from '@/components/PendingSyncBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers, useCreateCustomer } from '@/features/customers/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useSales } from '@/features/sales/hooks'
import { useInvoices } from '@/features/invoices/hooks'
import { computeCariLedger } from '@shared/businessLogic/cariLedger'
import type { CustomersStackParamList } from '@/navigation/types'
import type { Customer } from '@shared/types/database'

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomersList'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

/** Müşteri listesi + cari bakiye tek ekranda (masaüstündeki CariHesapListPage.tsx
 * mantığı, computeCariLedger shared/'dan). */
export function CustomersListScreen({ navigation }: Props) {
  const theme = useTheme()
  const [search, setSearch] = React.useState('')
  const [showAdd, setShowAdd] = React.useState(false)
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
      <ScreenHeader
        title="Müşteriler"
        subtitle={`${rows.length} doktor/cari`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
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
            <CustomerRow
              customer={item.customer}
              balance={item.balance}
              onPress={() =>
                navigation.navigate('CustomerDetail', { customerId: item.customer.id, customerName: item.customer.full_name })
              }
            />
          )}
        />
      )}
      <AddCustomerModal visible={showAdd} onClose={() => setShowAdd(false)} />
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

function CustomerRow({ customer, balance, onPress }: { customer: Customer; balance: number; onPress: () => void }) {
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

function AddCustomerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateCustomer()
  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [hospital, setHospital] = React.useState('')

  async function onSave() {
    if (!fullName.trim() || !phone.trim()) return
    await createMutation.mutateAsync({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      hospital_name: hospital.trim() || null,
    })
    setFullName(''); setPhone(''); setEmail(''); setHospital('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Doktor</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Ad Soyad *" value={fullName} onChangeText={setFullName} placeholder="Dr. Ahmet Yılmaz" />
          <TextField label="Telefon *" value={phone} onChangeText={setPhone} placeholder="05XX XXX XX XX" keyboardType="phone-pad" />
          <TextField label="E-posta" value={email} onChangeText={setEmail} placeholder="email@örnek.com" keyboardType="email-address" />
          <TextField label="Hastane/Klinik" value={hospital} onChangeText={setHospital} placeholder="Hastane adı" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!fullName.trim() || !phone.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
