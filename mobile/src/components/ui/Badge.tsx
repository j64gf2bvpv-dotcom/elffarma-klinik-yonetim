import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const theme = useTheme()
  const s = makeStyles(theme)
  return (
    <View style={[s.base, s[variant]]}>
      <Text style={[s.text, { color: textColor(theme, variant) }]}>{children}</Text>
    </View>
  )
}

function textColor(theme: Theme, variant: BadgeVariant): string {
  switch (variant) {
    case 'default':
      return theme.colors.primaryForeground
    case 'secondary':
      return theme.colors.secondaryForeground
    case 'destructive':
      return theme.colors.destructiveForeground
    case 'success':
      return theme.colors.successForeground
    case 'warning':
      return theme.colors.warningForeground
    case 'outline':
      return theme.colors.foreground
  }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
    },
    default: { backgroundColor: theme.colors.primary },
    secondary: { backgroundColor: theme.colors.secondary },
    destructive: { backgroundColor: theme.colors.destructive },
    success: { backgroundColor: theme.colors.success },
    warning: { backgroundColor: theme.colors.warning },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
    text: { fontSize: theme.fontSizes.xs, fontWeight: '600' },
  })
}
