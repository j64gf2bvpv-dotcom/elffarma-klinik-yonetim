import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, CalendarClock, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useInstallmentPlans, useCreateInstallmentPlan, useDeleteInstallmentPlan } from '@/features/installments/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Installments'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

export function InstallmentsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const { data: plans = [], isLoading } = useInstallmentPlans()
  const deleteMutation = useDeleteInstallmentPlan()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['payment_installment_plans'] })
    setRefreshing(false)
  }

  const totalOutstanding = plans.reduce((sum, p) => {
    const unpaid = p.installments.filter(i => !i.paid_payment_id).reduce((s, i) => s + Number(i.amount), 0)
    return sum + unpaid
  }, 0)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Taksit Planları"
        subtitle={`${plans.length} plan · ${currency(totalOutstanding)} kalan`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && plans.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id
            const ratio = item.installment_count > 0 ? item.paid_count / item.installment_count : 0
            return (
              <View>
                <ListItemCard
                  icon={CalendarClock}
                  iconColor={ratio >= 1 ? theme.colors.success : theme.colors.primary}
                  title={item.customer_name}
                  subtitle={[
                    `${item.installment_count} taksit`,
                    currency(Number(item.total_amount)),
                    item.description,
                  ].filter(Boolean).join(' · ')}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge variant={ratio >= 1 ? 'default' : 'outline'}>
                        {item.paid_count}/{item.installment_count} ödendi
                      </Badge>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable onPress={() => setExpandedId(isExpanded ? null : item.id)} hitSlop={8}>
                          {isExpanded ? <ChevronUp size={14} color={theme.colors.mutedForeground} /> : <ChevronDown size={14} color={theme.colors.mutedForeground} />}
                        </Pressable>
                        <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                          <Trash2 size={14} color={theme.colors.mutedForeground} />
                        </Pressable>
                      </View>
                    </View>
                  }
                />
                {isExpanded && (
                  <Card style={{ marginTop: 4, gap: 6 }}>
                    <ProgressBar ratio={ratio} color={ratio >= 1 ? theme.colors.success : theme.colors.primary} />
                    {item.installments.map((ins) => {
                      const isPaid = !!ins.paid_payment_id
                      const overdue = !isPaid && isPast(new Date(ins.due_date))
                      return (
                        <View key={ins.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderColor: theme.colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>#{ins.installment_no}</Text>
                            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
                              {format(new Date(ins.due_date), 'd MMM yyyy', { locale: trLocale })}
                            </Text>
                            {isPaid ? (
                              <Badge variant="default">Ödendi</Badge>
                            ) : overdue ? (
                              <Badge variant="destructive">Gecikti</Badge>
                            ) : null}
                          </View>
                          <Text style={{ color: isPaid ? theme.colors.mutedForeground : theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '600', textDecorationLine: isPaid ? 'line-through' : 'none' }}>
                            {currency(Number(ins.amount))}
                          </Text>
                        </View>
                      )
                    })}
                  </Card>
                )}
              </View>
            )
          }}
        />
      )}
      <AddPlanModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddPlanModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateInstallmentPlan()
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [totalAmount, setTotalAmount] = React.useState('')
  const [installmentCount, setInstallmentCount] = React.useState('3')
  const [description, setDescription] = React.useState('')

  async function onSave() {
    if (!customerId || !totalAmount || !installmentCount) return
    await createMutation.mutateAsync({
      customer_id: customerId,
      total_amount: Number(totalAmount),
      installment_count: Number(installmentCount),
      description: description.trim() || null,
    })
    setCustomerId(''); setCustomerName(''); setTotalAmount(''); setInstallmentCount('3'); setDescription('')
    onClose()
  }

  const perInstallment = totalAmount && installmentCount
    ? (Number(totalAmount) / Number(installmentCount)).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
    : null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Taksit Planı</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => setShowCustomerPicker(true)}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500', marginBottom: 4 }}>Doktor *</Text>
            <View style={{ height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: theme.colors.input }}>
              <Text style={{ color: customerName ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {customerName || 'Doktor seç...'}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Toplam Tutar *" value={totalAmount} onChangeText={setTotalAmount} placeholder="0" keyboardType="numeric" style={{ flex: 1 }} />
            <TextField label="Taksit Sayısı *" value={installmentCount} onChangeText={setInstallmentCount} placeholder="3" keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          {perInstallment && (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
              Taksit başına: ~{perInstallment} (30'ar günlük vadelerle otomatik oluşturulur)
            </Text>
          )}
          <TextField label="Açıklama" value={description} onChangeText={setDescription} placeholder="Örn: 3 ay vadeli" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!customerId || !totalAmount || !installmentCount}>
            Kaydet
          </Button>
        </View>
        <CustomerPickerModal
          visible={showCustomerPicker}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(c) => {
            setCustomerId(c.id)
            setCustomerName(c.full_name)
            setShowCustomerPicker(false)
          }}
        />
      </Screen>
    </Modal>
  )
}
