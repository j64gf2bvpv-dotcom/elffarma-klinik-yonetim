import * as React from 'react'
import { Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { Card } from './Card'

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
}) {
  const theme = useTheme()
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.primary + '26',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing(2.5),
        }}
      >
        <Icon size={20} color={theme.colors.primary} />
      </View>
      <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, fontWeight: '600', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xxl, fontWeight: '700', marginTop: 2 }}>
        {value}
      </Text>
      {sublabel && (
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs, marginTop: 2 }}>{sublabel}</Text>
      )}
    </Card>
  )
}
