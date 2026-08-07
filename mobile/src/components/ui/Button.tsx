import * as React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'
import type { Theme } from '@/lib/theme'

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled,
  loading,
  style,
}: {
  children: React.ReactNode
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const theme = useTheme()
  const s = makeStyles(theme)
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.base,
        s[variant],
        sizeStyles(theme)[size],
        isDisabled && s.disabled,
        pressed && !isDisabled && s.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor(theme, variant)} size="small" />
      ) : typeof children === 'string' ? (
        <Text style={[s.text, { color: textColor(theme, variant) }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

function textColor(theme: Theme, variant: ButtonVariant): string {
  switch (variant) {
    case 'default':
      return theme.colors.primaryForeground
    case 'destructive':
      return theme.colors.destructiveForeground
    case 'secondary':
      return theme.colors.secondaryForeground
    case 'outline':
    case 'ghost':
      return theme.colors.foreground
  }
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: theme.radius.md,
    },
    default: { backgroundColor: theme.colors.primary },
    destructive: { backgroundColor: theme.colors.destructive },
    secondary: { backgroundColor: theme.colors.secondary },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
    ghost: { backgroundColor: 'transparent' },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    text: { fontWeight: '600', fontSize: theme.fontSizes.sm },
  })
}

function sizeStyles(theme: Theme) {
  return StyleSheet.create({
    default: { height: 44, paddingHorizontal: theme.spacing(4) },
    sm: { height: 36, paddingHorizontal: theme.spacing(3) },
    lg: { height: 52, paddingHorizontal: theme.spacing(6) },
    icon: { height: 44, width: 44, paddingHorizontal: 0 },
  })
}
