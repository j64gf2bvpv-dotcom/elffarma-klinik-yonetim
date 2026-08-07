import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Building2, Phone, Mail, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers, useCreateCustomer } from '@/features/customers/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Customers'>

export function CustomersScreen({ navigation }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: customers = [], isLoading } = useCustomers(search)

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['customers'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Müşteriler"
        subtitle={`${customers.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <TextField placeholder="Ara (ad, telefon)..." value={search} onChangeText={setSearch} />
      {isLoading && customers.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={Building2}
              title={item.full_name}
              subtitle={[
                item.hospital_name,
                item.specialty,
                item.province,
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {item.is_vip && <Badge variant="warning">VIP</Badge>}
                  {item.doctor_type === 'hastane' && <Badge variant="secondary">Hastane</Badge>}
                </View>
              }
              onPress={() =>
                // CariHesap tab'ındaki detay ekranına git — parent tab navigator üzerinden
                navigation.getParent()?.navigate('CariHesapTab', {
                  screen: 'CariHesapDetail',
                  params: { customerId: item.id, customerName: item.full_name },
                })
              }
            />
          )}
        />
      )}
      <AddCustomerModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
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
