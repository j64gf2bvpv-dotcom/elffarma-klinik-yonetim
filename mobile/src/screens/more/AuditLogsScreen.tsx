import * as React from 'react'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { FilePlus, FilePen, FileX, Terminal, type LucideIcon } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useTheme } from '@/lib/ThemeContext'
import { useAuditLogs } from '@/features/auditLogs/hooks'
import type { AuditAction } from '@shared/types/database'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'AuditLogs'>

const actionIcons: Record<AuditAction, LucideIcon> = {
  insert: FilePlus,
  update: FilePen,
  delete: FileX,
  rpc: Terminal,
}

const actionColors: Record<AuditAction, 'success' | 'primary' | 'destructive' | 'warning'> = {
  insert: 'success',
  update: 'primary',
  delete: 'destructive',
  rpc: 'warning',
}

/**
 * Master talimat §34'teki Audit Log görüntüleyicisi — sadece admin
 * erişebilir (MoreMenuScreen'de adminOnly:true, Ayarlar'daki gibi). audit_logs
 * RLS'i zaten sadece is_admin() ile SELECT'e izin veriyor, bu ekran o
 * kısıtlamayı UI'da tekrarlıyor, tek güvenlik katmanı RLS.
 */
export function AuditLogsScreen(_: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState(false)
  const { data: logs = [], isLoading } = useAuditLogs()

  async function onRefresh() {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['audit_logs'] })
    setRefreshing(false)
  }

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Audit Log" subtitle={`Son ${logs.length} işlem`} />
      {isLoading && logs.length === 0 ? (
        <Text style={{ color: theme.colors.mutedForeground }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.mutedForeground }}>Kayıt yok</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const iconColorMap: Record<string, string> = {
              success: theme.colors.success,
              primary: theme.colors.primary,
              destructive: theme.colors.destructive,
              warning: theme.colors.warning,
            }
            return (
              <ListItemCard
                icon={actionIcons[item.action]}
                iconColor={iconColorMap[actionColors[item.action]]}
                title={item.description}
                subtitle={`${item.staff_name} · ${format(new Date(item.created_at), 'd MMM yyyy HH:mm', { locale: trLocale })}`}
              />
            )
          }}
        />
      )}
    </Screen>
  )
}
