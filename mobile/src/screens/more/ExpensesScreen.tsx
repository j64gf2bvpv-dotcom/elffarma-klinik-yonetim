import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, ReceiptText, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useExpenses, useCreateExpense, useDeleteExpense } from '@/features/expenses/hooks'
import type { ExpenseCategory } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Expenses'>

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const categoryLabels: Record<string, string> = {
  hizmet_gideri: 'Hizmet Gideri',
  diger: 'Diğer',
}

export function ExpensesScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: expenses = [], isLoading } = useExpenses()
  const deleteMutation = useDeleteExpense()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['expenses'] })
    setRefreshing(false)
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Giderler"
        subtitle={`${expenses.length} kayıt · ${currency(total)}`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && expenses.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <ListItemCard
              icon={ReceiptText}
              iconColor={theme.colors.destructive}
              title={item.description ?? categoryLabels[item.category] ?? item.category}
              subtitle={`${categoryLabels[item.category] ?? item.category} · ${format(new Date(item.expense_date), 'd MMM yyyy', { locale: trLocale })}`}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: theme.colors.destructive, fontWeight: '700' }}>−{currency(Number(item.amount))}</Text>
                  <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                    <Trash2 size={16} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              }
            />
          )}
        />
      )}
      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddExpenseModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateExpense()
  const [amount, setAmount] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState<ExpenseCategory>('hizmet_gideri')

  async function onSave() {
    if (!amount) return
    await createMutation.mutateAsync({
      amount: Number(amount),
      description: description.trim() || null,
      category,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
    })
    setAmount(''); setDescription(''); setCategory('hizmet_gideri')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Gider</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Tutar *" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
          <TextField label="Açıklama" value={description} onChangeText={setDescription} placeholder="Gider açıklaması" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant={category === 'hizmet_gideri' ? 'default' : 'outline'} size="sm" onPress={() => setCategory('hizmet_gideri')} style={{ flex: 1 }}>
              Hizmet
            </Button>
            <Button variant={category === 'diger' ? 'default' : 'outline'} size="sm" onPress={() => setCategory('diger')} style={{ flex: 1 }}>
              Diğer
            </Button>
          </View>
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!amount}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
