import * as React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { CloudOff } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { useOfflineSyncStatus } from '@/features/offline/OfflineSyncContext'

/** Masaüstü topbar'ındaki "N bekleyen kayıt" rozetinin mobil karşılığı. */
export function PendingSyncBadge() {
  const { pendingCount, syncing } = useOfflineSyncStatus()
  const theme = useTheme()

  if (pendingCount === 0) return null

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.warning,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing(2.5),
        paddingVertical: theme.spacing(1.5),
        marginBottom: theme.spacing(3),
      }}
    >
      {syncing ? (
        <ActivityIndicator size="small" color={theme.colors.warningForeground} />
      ) : (
        <CloudOff size={14} color={theme.colors.warningForeground} />
      )}
      <Text style={{ color: theme.colors.warningForeground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>
        {syncing ? 'Senkronize ediliyor...' : `${pendingCount} bekleyen kayıt — bağlantı gelince gönderilecek`}
      </Text>
    </View>
  )
}
