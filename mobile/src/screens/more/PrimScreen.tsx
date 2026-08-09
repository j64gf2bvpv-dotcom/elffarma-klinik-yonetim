import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { Percent, Pencil, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useTheme } from '@/lib/ThemeContext'
import { useSalesReps, useUpdateSalesRepTarget } from '@/features/salesReps/hooks'
import { useSales } from '@/features/sales/hooks'
import { usePayments } from '@/features/payments/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Prim'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function PrimScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: reps = [] } = useSalesReps()
  const { data: sales = [] } = useSales()
  const { data: payments = [] } = usePayments({})
  const [editingRep, setEditingRep] = React.useState<{ id: string; name: string; target: number } | null>(null)

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const repData = React.useMemo(() => {
    return reps.map((rep) => {
      const repSales = sales.filter(s => s.sales_rep_id === rep.id && s.type === 'sale')
      const repRevenue = repSales.reduce((sum, s) => sum + Number(s.quantity) * Number(s.unit_price), 0)
      const repPayments = payments.filter(p => p.sales_rep_id === rep.id)
      const collected = repPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const commissionRate = rep.commission_rate ?? 0
      const commission = (collected * commissionRate) / 100
      const target = rep.sales_target ?? 0
      const progress = target > 0 ? collected / target : 0
      return { rep, repRevenue, collected, commission, target, progress }
    })
  }, [reps, sales, payments])

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Prim" subtitle={`${reps.length} temsilci`} />
      <FlatList
        data={repData}
        keyExtractor={(r) => r.rep.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.primary + '26',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Percent size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>{item.rep.name}</Text>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                  Komisyon: %{item.rep.commission_rate ?? 0}
                </Text>
              </View>
              <Text style={{ color: theme.colors.success, fontWeight: '700' }}>{currency(item.commission)}</Text>
              <Pressable onPress={() => setEditingRep({ id: item.rep.id, name: item.rep.name, target: item.target })} hitSlop={8}>
                <Pencil size={14} color={theme.colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Tahsilat</Text>
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
                  {currency(item.collected)} {item.target > 0 && `/ ${currency(item.target)}`}
                </Text>
              </View>
              {item.target > 0 && <ProgressBar ratio={item.progress} />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Satış Cirosu</Text>
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
                  {currency(item.repRevenue)}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
      <EditTargetModal rep={editingRep} onClose={() => setEditingRep(null)} />
    </Screen>
  )
}

function EditTargetModal({ rep, onClose }: { rep: { id: string; name: string; target: number } | null; onClose: () => void }) {
  const theme = useTheme()
  const updateMutation = useUpdateSalesRepTarget()
  const [value, setValue] = React.useState('')

  React.useEffect(() => {
    if (rep) setValue(String(rep.target || ''))
  }, [rep])

  async function onSave() {
    if (!rep) return
    const num = Number(value)
    if (isNaN(num)) return
    await updateMutation.mutateAsync({ id: rep.id, target: num })
    onClose()
  }

  return (
    <Modal visible={!!rep} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>
            Hedef Düzenle
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        {rep && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
              {rep.name} — Aylık ciro hedefi
            </Text>
            <TextField
              label="Hedef Tutar (₺)"
              value={value}
              onChangeText={setValue}
              placeholder="0"
              keyboardType="numeric"
            />
            <Button onPress={onSave} loading={updateMutation.isPending} disabled={!value.trim()}>
              Kaydet
            </Button>
          </View>
        )}
      </Screen>
    </Modal>
  )
}
