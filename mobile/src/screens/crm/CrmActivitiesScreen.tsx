import * as React from 'react'
import { RefreshControl, Text } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Phone, MessageCircle, Mail, Users, Video, StickyNote, ClipboardList, type LucideIcon } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useCrmActivities } from '@/features/crm/hooks'
import { useMyTasks } from '@/features/tasks/hooks'
import { tr } from '@shared/i18n/tr'

const activityIcons: Record<string, LucideIcon> = {
  arama: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  toplanti: Users,
  video_gorusme: Video,
  not: StickyNote,
}

/**
 * gocust'un mobil CRM tanıtımındaki "Activities" ekranının (bekleyen görev
 * sayacı + kronolojik aktivite akışı) Elffarma karşılığı — masaüstündeki CRM
 * modülünün crm_activities verisini okuyor, yeni Görev Yönetimi'nden bana
 * atanan açık görev sayısını üstte gösteriyor. Aktivite/fırsat oluşturma
 * masaüstünde kalıyor (Faz 1 kapsamı, salt okunur).
 */
export function CrmActivitiesScreen() {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: activities = [], isLoading } = useCrmActivities()
  const { data: myTasks = [] } = useMyTasks()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['crm_activities'] })
    await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    setRefreshing(false)
  }

  return (
    <Screen
      scroll
      style={{ gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader title="Aktiviteler" subtitle="Doktor aktivite geçmişi" />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ClipboardList size={18} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Bekleyen Görevler</Text>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.lg }}>
          {myTasks.length}
        </Text>
      </Card>

      {isLoading && activities.length === 0 && (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      )}
      {!isLoading && activities.length === 0 && (
        <Text style={{ color: theme.colors.mutedForeground }}>Henüz aktivite yok</Text>
      )}
      {activities.map((activity) => (
        <ListItemCard
          key={activity.id}
          icon={activityIcons[activity.activity_type] ?? StickyNote}
          title={activity.customers?.full_name ?? '—'}
          subtitle={`${tr.crmActivityType[activity.activity_type] ?? activity.activity_type}${activity.subject ? ` — ${activity.subject}` : ''} · ${format(new Date(activity.occurred_at), 'd MMM HH:mm', { locale: trLocale })}`}
        />
      ))}
    </Screen>
  )
}
