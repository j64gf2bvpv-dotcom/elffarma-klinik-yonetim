import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { format, isPast, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, CheckSquare, Square, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { useTheme } from '@/lib/ThemeContext'
import { useTasks, useCreateTask, useUpdateTaskStatus, useDeleteTask } from '@/features/tasks/hooks'
import type { TaskStatus, TaskPriority } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Tasks'>

const statusLabels: Record<TaskStatus, string> = {
  bekliyor: 'Bekliyor',
  devam_ediyor: 'Devam Ediyor',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
}

const priorityLabels: Record<TaskPriority, string> = {
  dusuk: 'Düşük',
  normal: 'Normal',
  yuksek: 'Yüksek',
}

const priorityColors: Record<TaskPriority, 'muted' | 'primary' | 'destructive'> = {
  dusuk: 'muted',
  normal: 'primary',
  yuksek: 'destructive',
}

const statusFilters: (TaskStatus | 'all')[] = ['all', 'bekliyor', 'devam_ediyor', 'tamamlandi', 'iptal']

export function TasksScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [filter, setFilter] = React.useState<TaskStatus | 'all'>('all')
  const { data: tasks = [], isLoading } = useTasks(filter)
  const statusMutation = useUpdateTaskStatus()
  const deleteMutation = useDeleteTask()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    setRefreshing(false)
  }

  const pendingCount = tasks.filter(t => t.status === 'bekliyor' || t.status === 'devam_ediyor').length

  function cycleStatus(task: { id: string; status: TaskStatus }) {
    const next: TaskStatus = task.status === 'bekliyor' ? 'devam_ediyor' : task.status === 'devam_ediyor' ? 'tamamlandi' : 'bekliyor'
    statusMutation.mutate({ id: task.id, status: next })
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Görevler"
        subtitle={`${pendingCount} aktif · ${tasks.length} toplam`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
        {statusFilters.map(s => (
          <Pressable key={s} onPress={() => setFilter(s)} hitSlop={4}>
            <Badge variant={filter === s ? 'default' : 'outline'}>
              {s === 'all' ? 'Tümü' : statusLabels[s]}
            </Badge>
          </Pressable>
        ))}
      </ScrollView>
      {isLoading && tasks.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const overdue = item.due_date && item.status !== 'tamamlandi' && item.status !== 'iptal' && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date))
            return (
              <ListItemCard
                icon={item.status === 'tamamlandi' ? CheckSquare : Square}
                iconColor={item.status === 'tamamlandi' ? theme.colors.success : overdue ? theme.colors.destructive : theme.colors.primary}
                title={item.title}
                subtitle={[
                  item.customer_name,
                  item.assigned_to_name,
                  item.due_date ? format(new Date(item.due_date), 'd MMM yyyy', { locale: trLocale }) : null,
                ].filter(Boolean).join(' · ') || (item.description ?? undefined)}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {item.priority !== 'normal' && (
                      <Badge variant={priorityColors[item.priority] === 'destructive' ? 'destructive' : 'outline'}>
                        {priorityLabels[item.priority]}
                      </Badge>
                    )}
                    {overdue && <Badge variant="destructive">Gecikti</Badge>}
                    <Pressable onPress={() => cycleStatus(item)} hitSlop={8}>
                      {item.status === 'tamamlandi' ? (
                        <CheckSquare size={20} color={theme.colors.success} />
                      ) : (
                        <Square size={20} color={theme.colors.mutedForeground} />
                      )}
                    </Pressable>
                    <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                      <Trash2 size={14} color={theme.colors.mutedForeground} />
                    </Pressable>
                  </View>
                }
              />
            )
          }}
        />
      )}
      <AddTaskModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddTaskModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateTask()
  const [showCustomerPicker, setShowCustomerPicker] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priority, setPriority] = React.useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = React.useState('')

  async function onSave() {
    if (!title.trim()) return
    await createMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate || null,
      customer_id: customerId || null,
    })
    setCustomerId(''); setCustomerName(''); setTitle(''); setDescription(''); setPriority('normal'); setDueDate('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Görev</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Başlık *" value={title} onChangeText={setTitle} placeholder="Görev başlığı" />
          <TextField label="Açıklama" value={description} onChangeText={setDescription} placeholder="Detay..." multiline />
          <Pressable onPress={() => setShowCustomerPicker(true)}>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500', marginBottom: 4 }}>İlgili Doktor (opsiyonel)</Text>
            <View style={{ height: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: theme.colors.input }}>
              <Text style={{ color: customerName ? theme.colors.foreground : theme.colors.mutedForeground }}>
                {customerName || 'Doktor seç...'}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextField label="Bitiş Tarihi" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['dusuk', 'normal', 'yuksek'] as TaskPriority[]).map(p => (
              <Button key={p} variant={priority === p ? 'default' : 'outline'} size="sm" onPress={() => setPriority(p)} style={{ flex: 1 }}>
                {priorityLabels[p]}
              </Button>
            ))}
          </View>
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!title.trim()}>
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
