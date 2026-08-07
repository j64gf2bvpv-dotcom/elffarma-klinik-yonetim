import * as React from 'react'
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, BellRing, Circle, CheckCircle2, Trash2, X } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useReminders, useCreateReminder, useUpdateReminder, useDeleteReminder } from '@/features/reminders/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Reminders'>

export function RemindersScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: reminders = [], isLoading } = useReminders()
  const updateMutation = useUpdateReminder()
  const deleteMutation = useDeleteReminder()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['reminders'] })
    setRefreshing(false)
  }

  const pending = reminders.filter(r => !r.is_done)
  const done = reminders.filter(r => r.is_done)

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Hatırlatmalar"
        subtitle={`${pending.length} bekleyen · ${done.length} tamam`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {isLoading && reminders.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const overdue = !item.is_done && item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date))
            return (
              <ListItemCard
                icon={item.is_done ? CheckCircle2 : BellRing}
                iconColor={item.is_done ? theme.colors.success : overdue ? theme.colors.destructive : theme.colors.primary}
                title={item.title}
                subtitle={item.note ?? undefined}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {item.due_date && (
                      <Badge variant={overdue ? 'destructive' : 'outline'}>
                        {format(new Date(item.due_date), 'd MMM', { locale: trLocale })}
                      </Badge>
                    )}
                    <Pressable
                      onPress={() => updateMutation.mutate({ id: item.id, patch: { is_done: !item.is_done } })}
                      hitSlop={8}
                    >
                      <Circle size={18} color={item.is_done ? theme.colors.success : theme.colors.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => deleteMutation.mutate(item.id)} hitSlop={8}>
                      <Trash2 size={16} color={theme.colors.destructive} />
                    </Pressable>
                  </View>
                }
              />
            )
          }}
        />
      )}
      <AddReminderModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}

function AddReminderModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme()
  const createMutation = useCreateReminder()
  const [title, setTitle] = React.useState('')
  const [note, setNote] = React.useState('')
  const [dueDate, setDueDate] = React.useState(format(new Date(), 'yyyy-MM-dd'))

  async function onSave() {
    if (!title.trim()) return
    await createMutation.mutateAsync({
      title: title.trim(),
      note: note.trim() || null,
      due_date: dueDate,
    })
    setTitle(''); setNote('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '700' }}>Yeni Hatırlatma</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          <TextField label="Başlık *" value={title} onChangeText={setTitle} placeholder="Hatırlatma başlığı" />
          <TextField label="Not" value={note} onChangeText={setNote} placeholder="Detay..." multiline />
          <TextField label="Tarih" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
          <Button onPress={onSave} loading={createMutation.isPending} disabled={!title.trim()}>
            Kaydet
          </Button>
        </View>
      </Screen>
    </Modal>
  )
}
