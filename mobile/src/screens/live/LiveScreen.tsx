import * as React from 'react'
import { RefreshControl, Text, View } from 'react-native'
import { format, isToday } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Radio, Stethoscope, LogIn, LogOut, CheckSquare, Phone, MessageCircle, Mail, Users, Video, StickyNote, type LucideIcon } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/lib/ThemeContext'
import { useVisits } from '@/features/doctorVisits/hooks'
import { useMyTasks } from '@/features/tasks/hooks'
import { useCrmActivities } from '@/features/crm/hooks'
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
 * gocust'un "Live" sekmesinden ilham alınan anlık durum akışı — bugünün
 * ziyaretleri (check-in/check-out durumuyla), açık görev sayısı ve en son
 * CRM aktiviteleri tek ekranda. "Panel" (Anasayfa) sekmesinin aksine burada
 * geçmiş/istatistik değil, "şu an ne oluyor" görünür.
 */
export function LiveScreen() {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: visits = [] } = useVisits()
  const { data: myTasks = [] } = useMyTasks()
  const { data: activities = [] } = useCrmActivities()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  const todaysVisits = React.useMemo(
    () => visits.filter((v) => isToday(new Date(v.visit_date))),
    [visits],
  )
  const activeVisits = todaysVisits.filter((v) => v.check_in_at && !v.check_out_at)
  const recentActivities = activities.slice(0, 8)

  return (
    <Screen
      scroll
      style={{ gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <ScreenHeader
        title="Canlı"
        subtitle={`${format(new Date(), 'd MMMM yyyy, EEEE', { locale: trLocale })}`}
        actions={<Radio size={18} color={theme.colors.success} />}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: theme.fontSizes.xl }}>
            {activeVisits.length}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, textAlign: 'center' }}>
            Şu an sahada
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.xl }}>
            {todaysVisits.length}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, textAlign: 'center' }}>
            Bugünkü ziyaret
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          <Text style={{ color: theme.colors.warning, fontWeight: '700', fontSize: theme.fontSizes.xl }}>
            {myTasks.length}
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, textAlign: 'center' }}>
            Açık görev
          </Text>
        </Card>
      </View>

      {todaysVisits.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>
            Bugünkü Ziyaretler
          </Text>
          <Card style={{ gap: 10 }}>
            {todaysVisits.map((v) => {
              const isActive = !!v.check_in_at && !v.check_out_at
              const isDone = !!v.check_in_at && !!v.check_out_at
              return (
                <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Stethoscope size={16} color={isActive ? theme.colors.success : theme.colors.mutedForeground} />
                  <Text style={{ color: theme.colors.foreground, flex: 1 }} numberOfLines={1}>{v.doctor_name}</Text>
                  {isActive && (
                    <Badge variant="default">
                      <LogIn size={10} color={theme.colors.primaryForeground} /> Sahada
                    </Badge>
                  )}
                  {isDone && (
                    <Badge variant="secondary">
                      <LogOut size={10} color={theme.colors.foreground} /> Tamamlandı
                    </Badge>
                  )}
                  {!v.check_in_at && <Badge variant="outline">Planlandı</Badge>}
                </View>
              )
            })}
          </Card>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>
          Son Aktiviteler
        </Text>
        <Card style={{ gap: 10 }}>
          {recentActivities.length === 0 && (
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>Henüz aktivite yok</Text>
          )}
          {recentActivities.map((activity) => {
            const Icon = activityIcons[activity.activity_type] ?? StickyNote
            return (
              <View key={activity.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon size={16} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm }} numberOfLines={1}>
                    {activity.customers?.full_name ?? '—'}
                  </Text>
                  <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
                    {tr.crmActivityType[activity.activity_type] ?? activity.activity_type} · {format(new Date(activity.occurred_at), 'HH:mm', { locale: trLocale })}
                  </Text>
                </View>
              </View>
            )
          })}
        </Card>
      </View>

      {myTasks.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, fontWeight: '600' }}>
            Görevlerim
          </Text>
          <Card style={{ gap: 10 }}>
            {myTasks.slice(0, 5).map((task) => (
              <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <CheckSquare size={16} color={theme.colors.mutedForeground} />
                <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                  {task.title}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  )
}
