import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, Fuel, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useFuelLogs, useCreateFuelLog, useDeleteFuelLog } from '@/features/fuelLogs/hooks'
import { useVehicles } from '@/features/vehicles/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'FuelLogs'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
}

export function FuelLogsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: logs = [], isLoading } = useFuelLogs()
  const { data: vehicles = [] } = useVehicles()
  const deleteMutation = useDeleteFuelLog()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['vehicle_fuel_logs'] })
    setRefreshing(false)
  }

  const totalSpent = logs.reduce((sum, l) => sum + Number(l.amount), 0)
  const vehicleMap = new Map(vehicles.map(v => [v.id, `${v.plate_number ?? 'Plaka yok'} (${v.brand_model})`]))

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Yakıt Kayıtları"
        subtitle={`${logs.length} kayıt · ${currency(totalSpent)} toplam`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)} disabled={vehicles.length === 0}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {vehicles.length === 0 && (
        <Text style={{ color: theme.colors.warning, fontSize: theme.fontSizes.sm }}>
          Önce Araçlar ekranından bir araç ekleyin.
        </Text>
      )}
      {isLoading && logs.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={Fuel}
              iconColor={theme.colors.primary}
              title={vehicleMap.get(item.vehicle_id) ?? 'Araç'}
              subtitle={[
                format(new Date(item.fill_date), 'd MMM yyyy', { locale: trLocale }),
                item.note,
              ].filter(Boolean).join(' · ') || undefined}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '700' }}>{currency(Number(item.amount))}</Text>
                  <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                    <Trash2 size={14} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              }
            />
          )}
        />
      )}
      <AddFuelLogModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddFuelLogModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateFuelLog()
  const { data: vehicles = [] } = useVehicles()
  const [vehicleId, setVehicleId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [fillDate, setFillDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = React.useState('')
  const [showVehiclePicker, setShowVehiclePicker] = React.useState(false)

  async function onSave() {
    if (!vehicleId || !amount) return
    await createMutation.mutateAsync({
      vehicle_id: vehicleId,
      fill_date: fillDate,
      amount: Number(amount),
      note: note.trim() || null,
    })
    setVehicleId(''); setAmount(''); setNote(''); setFillDate(format(new Date(), 'yyyy-MM-dd'))
    onClose()
  }

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Yakıt Kaydı</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => setShowVehiclePicker(!showVehiclePicker)}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500', marginBottom: 4 }}>Araç *</Text>
            <View style={{ height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: theme.colors.input }}>
              <Text style={{ color: selectedVehicle ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {selectedVehicle ? `${selectedVehicle.plate_number ?? 'Plaka yok'} (${selectedVehicle.brand_model})` : 'Araç seç...'}
              </Text>
            </View>
          </Pressable>
          {showVehiclePicker && (
            <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, maxHeight: 200 }}>
              {vehicles.map(v => (
                <Pressable key={v.id} onPress={() => { setVehicleId(v.id); setShowVehiclePicker(false) }} style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.foreground }}>{v.plate_number ?? 'Plaka yok'} ({v.brand_model})</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Tutar (₺) *" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
            <TextField label="Tarih" value={fillDate} onChangeText={setFillDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          </View>
          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Örn: Full depo" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!vehicleId || !amount}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
