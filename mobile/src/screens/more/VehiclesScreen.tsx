import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Car, Trash2, X, Wrench } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useVehicles, useCreateVehicle, useDeleteVehicle } from '@/features/vehicles/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Vehicles'>

export function VehiclesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: vehicles = [], isLoading } = useVehicles()
  const deleteMutation = useDeleteVehicle()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Araçlar"
        subtitle={`${vehicles.length} kayıt`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && vehicles.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={Car}
              title={item.brand_model}
              subtitle={[
                item.plate_number,
                item.year?.toString(),
                item.sales_reps?.name,
                item.vendor_company,
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.has_utts && <Badge variant="success">UTTS</Badge>}
                  {item.maintenance_date && (
                    <Badge variant="warning">
                      <Wrench size={10} color={theme.colors.warningForeground} />{' '}
                      {format(new Date(item.maintenance_date), 'd MMM', { locale: trLocale })}
                    </Badge>
                  )}
                  <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                    <Trash2 size={16} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              }
            />
          )}
        />
      )}
      <AddVehicleModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddVehicleModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateVehicle()
  const [brandModel, setBrandModel] = React.useState('')
  const [plate, setPlate] = React.useState('')
  const [year, setYear] = React.useState('')
  const [vendor, setVendor] = React.useState('')
  const [rental, setRental] = React.useState('')
  const [hasUtts, setHasUtts] = React.useState(false)

  async function onSave() {
    if (!brandModel.trim()) return
    await createMutation.mutateAsync({
      brand_model: brandModel.trim(),
      plate_number: plate.trim() || null,
      year: year ? Number(year) : null,
      vendor_company: vendor.trim() || null,
      monthly_rental_price: rental ? Number(rental) : null,
      has_utts: hasUtts,
    })
    setBrandModel(''); setPlate(''); setYear(''); setVendor(''); setRental(''); setHasUtts(false)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Araç</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Marka/Model *" value={brandModel} onChangeText={setBrandModel} placeholder="VW Passat" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Plaka" value={plate} onChangeText={setPlate} placeholder="34 ABC 123" style={{ flex: 1 }} autoCapitalize="characters" />
            <TextField label="Yıl" value={year} onChangeText={setYear} placeholder="2024" keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          <TextField label="Firma" value={vendor} onChangeText={setVendor} placeholder="Kiralama firması" />
          <TextField label="Aylık Kira" value={rental} onChangeText={setRental} placeholder="0" keyboardType="numeric" />
          <Button variant={hasUtts ? 'default' : 'outline'} size="sm" onPress={() => setHasUtts(!hasUtts)}>
            UTTS {hasUtts ? '✓' : ''}
          </Button>
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!brandModel.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
