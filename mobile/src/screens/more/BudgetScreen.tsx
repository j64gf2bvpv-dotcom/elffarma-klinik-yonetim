import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { Target, Pencil, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useTheme } from '@/lib/ThemeContext'
import { useBudgetTargets, useSaveBudgetTarget } from '@/features/budget/hooks'
import { usePayments } from '@/features/payments/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Budget'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export function BudgetScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [editing, setEditing] = React.useState<{ year: number; month: number; current: number } | null>(null)
  const now = new Date()
  const year = now.getFullYear()
  const { data: targets = [] } = useBudgetTargets(year)
  const { data: payments = [] } = usePayments({})
  const saveMutation = useSaveBudgetTarget()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['budget'] })
    setRefreshing(false)
  }

  const monthlyData = React.useMemo(() => {
    const targetMap = new Map(targets.map(t => [`${t.year}-${t.month}`, Number(t.target_revenue)]))
    const paymentMap = new Map<string, number>()
    for (const p of payments) {
      const d = new Date(p.paid_at)
      if (d.getFullYear() === year) {
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        paymentMap.set(key, (paymentMap.get(key) ?? 0) + Number(p.amount))
      }
    }
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const key = `${year}-${month}`
      return {
        year, month,
        label: `${monthNames[i]} ${year}`,
        target: targetMap.get(key) ?? 0,
        actual: paymentMap.get(key) ?? 0,
      }
    })
  }, [targets, payments, year])

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Bütçe Yılı" subtitle={String(year)} />
      <FlatList
        data={monthlyData}
        keyExtractor={(m) => `${m.year}-${m.month}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const pct = item.target > 0 ? Math.min(1, item.actual / item.target) : 0
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Target size={16} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>{item.label}</Text>
                <Pressable onPress={() => setEditing({ year: item.year, month: item.month, current: item.target })} hitSlop={8}>
                  <Pencil size={14} color={theme.colors.mutedForeground} />
                </Pressable>
              </View>
              {item.target > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                      {currency(item.actual)} / {currency(item.target)}
                    </Text>
                    <Text style={{ color: pct >= 1 ? theme.colors.success : theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '700' }}>
                      %{Math.round(pct * 100)}
                    </Text>
                  </View>
                  <ProgressBar ratio={pct} color={pct >= 1 ? theme.colors.success : pct >= 0.5 ? theme.colors.primary : theme.colors.warning} />
                </>
              ) : (
                <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                  Hedef belirlenmemiş · Tahsilat: {currency(item.actual)}
                </Text>
              )}
            </Card>
          )
        }}
      />
      <EditTargetModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={async (val) => {
          if (editing) {
            await saveMutation.mutateAsync({ year: editing.year, month: editing.month, targetRevenue: val })
            setEditing(null)
          }
        }}
        loading={saveMutation.isPending}
      />
    </Screen>
  )
}

function EditTargetModal({
  editing,
  onClose,
  onSave,
  loading,
}: {
  editing: { year: number; month: number; current: number } | null
  onClose: () => void
  onSave: (val: number) => void
  loading: boolean
}) {
  const theme = useTheme()
  const [value, setValue] = React.useState('')

  React.useEffect(() => {
    if (editing) setValue(String(editing.current || ''))
  }, [editing])

  if (!editing) return null
  const label = `${monthNames[editing.month - 1]} ${editing.year} Hedefi`

  return (
    <Modal visible={!!editing} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>{label}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={theme.colors.foreground} />
            </Pressable>
          </View>
          <TextField label="Hedef Tutar" value={value} onChangeText={setValue} placeholder="0" keyboardType="numeric" />
          <Button onPress={() => onSave(Number(value) || 0)} loading={loading}>
            Kaydet
          </Button>
        </View>
      </View>
    </Modal>
  )
}
