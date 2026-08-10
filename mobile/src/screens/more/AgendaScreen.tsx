import * as React from 'react'
import { Animated, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isPast,
  isSameMonth,
  isToday,
  isTomorrow,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Bell, CalendarDays, BellRing, ChevronLeft, ChevronRight, Stethoscope, CheckCircle2, Plus } from 'lucide-react-native'
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
}

const weekdayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function dateLabel(dateStr: string): { label: string; overdue: boolean } {
  const d = parseISO(dateStr)
  if (isToday(d)) return { label: 'Bugün', overdue: false }
  if (isTomorrow(d)) return { label: 'Yarın', overdue: false }
  const overdue = isPast(d) && !isToday(d)
  return { label: format(d, 'd MMM yyyy', { locale: trLocale }), overdue }
}

/**
 * Ajanda — ay görünümlü takvim (üstte, gün hücrelerinde etkinlik noktaları)
 * + altta seçili günün veya "yaklaşan" listesi. Her üç kaynak da
 * (Hatırlatmalar/Ziyaret takibi/Görevler) zaten kendi oluşturma noktasında
 * yerel bildirim kuruyor (scheduleReminderNotification/scheduleTaskNotification/
 * scheduleVisitFollowUpNotification, features/notifications/localNotifications.ts)
 * — buradaki zil rozeti bunu görünür kılıyor, yeni bir bildirim mekanizması
 * eklemiyor.
 */
export function AgendaScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showAdd, setShowAdd] = React.useState(false)
  const [monthAnchor, setMonthAnchor] = React.useState(new Date())
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const fade = React.useRef(new Animated.Value(1)).current
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
        result.push({ id: `t-${t.id}`, title: t.title, subtitle: t.description ?? undefined, date: t.due_date, type: 'task' })
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [reminders, visits, tasks])

  const itemsByDate = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of items) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [items])

  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [monthAnchor])

  function changeMonth(delta: 1 | -1) {
    fade.setValue(0)
    setMonthAnchor((d) => (delta === 1 ? addMonths(d, 1) : subMonths(d, 1)))
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }

  const iconFor = (type: AgendaItem['type']) => (type === 'reminder' ? BellRing : type === 'visit' ? Stethoscope : CheckCircle2)
  const colorFor = (type: AgendaItem['type']) => (type === 'reminder' ? theme.colors.warning : type === 'visit' ? theme.colors.primary : theme.colors.success)

  const displayedItems = selectedDate ? items.filter((i) => i.date === selectedDate) : items

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

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronLeft size={20} color={theme.colors.foreground} />
        </Pressable>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
          {format(monthAnchor, 'MMMM yyyy', { locale: trLocale })}
        </Text>
        <Pressable onPress={() => changeMonth(1)} hitSlop={10} style={{ padding: 6 }}>
          <ChevronRight size={20} color={theme.colors.foreground} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {weekdayLabels.map((w) => (
          <View key={w} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 4 }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>{w}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', opacity: fade }}>
        {gridDays.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const dayItems = itemsByDate.get(dayStr) ?? []
          const inMonth = isSameMonth(day, monthAnchor)
          const selected = selectedDate === dayStr
          const today = isToday(day)
          return (
            <Pressable
              key={dayStr}
              onPress={() => setSelectedDate((prev) => (prev === dayStr ? null : dayStr))}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.colors.primary : today ? theme.colors.primary + '22' : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: selected
                      ? theme.colors.primaryForeground
                      : !inMonth
                        ? theme.colors.mutedForeground + '80'
                        : today
                          ? theme.colors.primary
                          : theme.colors.foreground,
                    fontSize: theme.fontSizes.sm,
                    fontWeight: today || selected ? '700' : '400',
                  }}
                >
                  {format(day, 'd')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 2 }}>
                {dayItems.slice(0, 3).map((it) => (
                  <View key={it.id} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colorFor(it.type) }} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </Animated.View>

      {selectedDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', fontSize: theme.fontSizes.sm }}>
            {format(parseISO(selectedDate), 'd MMMM yyyy, EEEE', { locale: trLocale })}
          </Text>
          <Pressable onPress={() => setSelectedDate(null)} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Tümünü Göster</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={displayedItems}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 8, paddingTop: 24 }}>
            <CalendarDays size={40} color={theme.colors.mutedForeground} />
            <Text style={{ color: theme.colors.mutedForeground }}>
              {selectedDate ? 'Bu gün için etkinlik yok' : 'Yaklaşan etkinlik yok'}
            </Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Bell size={12} color={theme.colors.mutedForeground} />
                  <Badge variant={overdue ? 'destructive' : 'outline'}>{label}</Badge>
                </View>
              }
            />
          )
        }}
      />
      <AddReminderModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  )
}
