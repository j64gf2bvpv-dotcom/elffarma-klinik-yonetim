import * as React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { AppModal } from '@/components/ui/AppModal'
import { Plus, UserPlus, X } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers, useCreateCustomer } from '@/features/customers/hooks'
import type { Customer } from '@shared/types/database'

/**
 * Kullanıcı isteğiyle (2026-08-17) — ortadaki "+" (Yeni Sipariş) sekmesine
 * basınca önceden sadece MEVCUT müşteri listesinden seçim yapılabiliyordu.
 * Artık "Yeni Müşteri Ekle" ile listeye bağlı kalmadan manuel olarak yeni
 * bir müşteri girip doğrudan o müşteri için siparişe geçilebiliyor —
 * DoctorsListScreen'deki AddDoctorModal ile aynı zorunlu alanlar (ad
 * soyad, telefon), oluşturulan müşteri hemen onSelect ile seçiliyor.
 */
export function CustomerPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (customer: Customer) => void
}) {
  const theme = useTheme()
  const [mode, setMode] = React.useState<'pick' | 'add'>('pick')
  const [search, setSearch] = React.useState('')
  const { data: customers = [], isLoading } = useCustomers(search)

  function handleClose() {
    setMode('pick')
    setSearch('')
    onClose()
  }

  function handleCreated(customer: Customer) {
    setMode('pick')
    setSearch('')
    onSelect(customer)
  }

  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
            {mode === 'pick' ? 'Müşteri Seç' : 'Yeni Müşteri'}
          </Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>

        {mode === 'pick' ? (
          <>
            <TextField
              placeholder="Ara (ad, telefon)..."
              value={search}
              onChangeText={setSearch}
              containerStyle={{ marginBottom: 12 }}
              autoFocus
            />
            <Pressable
              onPress={() => setMode('add')}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.colors.primary + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={15} color={theme.colors.primary} />
              </View>
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Yeni Müşteri Ekle</Text>
            </Pressable>
            {isLoading && customers.length === 0 ? (
              <Text style={{ color: theme.colors.mutedForeground, marginTop: 12 }}>Yükleniyor...</Text>
            ) : (
              <FlatList
                data={customers}
                keyExtractor={(c) => c.id}
                ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground, marginTop: 12 }}>Sonuç yok</Text>}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => onSelect(item)}
                    style={({ pressed }) => [{ paddingVertical: 14 }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{item.full_name}</Text>
                    {item.hospital_name && (
                      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{item.hospital_name}</Text>
                    )}
                  </Pressable>
                )}
              />
            )}
          </>
        ) : (
          <NewCustomerForm onCancel={() => setMode('pick')} onCreated={handleCreated} />
        )}
      </Screen>
    </AppModal>
  )
}

function NewCustomerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (customer: Customer) => void }) {
  const theme = useTheme()
  const createMutation = useCreateCustomer()
  const [fullName, setFullName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [hospital, setHospital] = React.useState('')

  async function onSave() {
    if (!fullName.trim() || !phone.trim()) return
    const customer = await createMutation.mutateAsync({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      hospital_name: hospital.trim() || null,
    })
    onCreated(customer)
  }

  return (
    <View style={{ gap: 12 }}>
      <TextField label="Ad Soyad *" value={fullName} onChangeText={setFullName} placeholder="Dr. Ahmet Yılmaz" autoFocus />
      <TextField label="Telefon *" value={phone} onChangeText={setPhone} placeholder="05XX XXX XX XX" keyboardType="phone-pad" />
      <TextField label="E-posta" value={email} onChangeText={setEmail} placeholder="email@örnek.com" keyboardType="email-address" />
      <TextField label="Hastane/Klinik" value={hospital} onChangeText={setHospital} placeholder="Hastane adı" />
      <Button onPress={onSave} loading={createMutation.isPending} disabled={!fullName.trim() || !phone.trim()}>
        <Plus size={16} color={theme.colors.primaryForeground} />
        <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Müşteriyi Ekle ve Devam Et</Text>
      </Button>
      <Button variant="ghost" onPress={onCancel}>
        Vazgeç
      </Button>
    </View>
  )
}
