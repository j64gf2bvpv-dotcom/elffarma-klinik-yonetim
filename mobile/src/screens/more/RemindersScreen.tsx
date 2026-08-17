import * as React from 'react'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { format, isPast, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Plus, BellRing, Circle, CheckCircle2, Trash2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { AddReminderModal } from '@/components/AddReminderModal'
import { useTheme } from '@/lib/ThemeContext'
import { useReminders, useUpdateReminder, useDeleteReminder } from '@/features/reminders/hooks'
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
    <Screen
      scroll
      style={{ gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader
        title="Hatırlatmalar"
        subtitle={`${pending.length} bekleyen · ${done.length} tamam`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      {/* Kullanıcı isteğiyle (2026-08-17) FlatList yerine düz View + .map() —
          Screen zaten tek bir dış ScrollView, içine ikinci bir FlatList
          koymak kaydırmayı kesiyordu. */}
      {isLoading && reminders.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : reminders.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {reminders.map((item) => {
            const overdue = !item.is_done && item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date))
            return (
              <ListItemCard
                key={item.id}
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
          })}
        </View>
      )}
      <AddReminderModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}
