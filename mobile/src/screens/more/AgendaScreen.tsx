import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { CalendarDays, BellRing, Stethoscope, CheckCircle2, Plus } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AddReminderModal } from '@/components/AddReminderModal'
import { useTheme } from '@/lib/ThemeContext'
import { useReminders } from '@/features/reminders/hooks'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useMyTasks } from '@/features/tasks/hooks'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Agenda'>

interface AgendaItem {
  id: string
  title: string
  subtitle?: string
  date: string
  type: 'reminder' | 'visit' | 'task'
  isDone?: boolean
}

function dateLabel(dateStr: string): { label: string; overdue: boolean } {
  const d = parseISO(dateStr)
  if (isToday(d)) return { label: 'Bugün', overdue: false }
  if (isTomorrow(d)) return { label: 'Yarın', overdue: false }
  const overdue = isPast(d) && !isToday(d)
  return { label: format(d, 'd MMM yyyy', { locale: trLocale }), overdue }
}

export function AgendaScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const { data: reminders = [] } = useReminders()
  const { data: visits = [] } = useVisits()
  const { data: tasks = [] } = useMyTasks()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const items: AgendaItem[] = React.useMemo(() => {
    const result: AgendaItem[] = []
    for (const r of reminders) {
      if (!r.is_done) result.push({ id: `r-${r.id}`, title: r.title, subtitle: r.note ?? undefined, date: r.due_date, type: 'reminder' })
    }
    for (const v of visits) {
      if (v.next_visit_date) result.push({ id: `v-${v.id}`, title: v.doctor_name, subtitle: 'Ziyaret takibi', date: v.next_visit_date, type: 'visit' })
    }
    for (const t of tasks) {
      if (t.due_date && t.status !== 'tamamlandi' && t.status !== 'iptal') {
        result.push({ id: `t-${t.id}`, title: t.title, subtitle: t.description ?? undefined, date: t.due_date, type: 'task', isDone: false })
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [reminders, visits, tasks])

  const iconFor = (type: AgendaItem['type']) => type === 'reminder' ? BellRing : type === 'visit' ? Stethoscope : CheckCircle2
  const colorFor = (type: AgendaItem['type']) => type === 'reminder' ? theme.colors.warning : type === 'visit' ? theme.colors.primary : theme.colors.success

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader
        title="Ajanda"
        subtitle={`${items.length} yaklaşan etkinlik`}
        actions={
          <Button size="sm" onPress={() => setShowAdd(true)}>
            <Plus size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 40 }}>
            <CalendarDays size={40} color={theme.colors.mutedForeground} />
            <Text style={{ color: theme.colors.mutedForeground }}>Yaklaşan etkinlik yok</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const { label, overdue } = dateLabel(item.date)
          return (
            <ListItemCard
              icon={iconFor(item.type)}
              iconColor={overdue ? theme.colors.destructive : colorFor(item.type)}
              title={item.title}
              subtitle={item.subtitle}
              right={
                <Badge variant={overdue ? 'destructive' : 'outline'}>{label}</Badge>
              }
            />
          )
        }}
      />
      <AddReminderModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}
