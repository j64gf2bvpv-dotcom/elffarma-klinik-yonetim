import * as React from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: theme.spacing(4),
          // RN'de CSS backdrop-blur/multi-layer box-shadow yok — iOS/Android'in
          // kendi gölge sistemleriyle sadeleştirilmiş bir yorum (bkz. plan
          // §Risks: "glassmorphism fidelity").
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <View style={{ marginBottom: 10 }}>{children}</View>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.lg, fontWeight: '600' }}>
      {children}
    </Text>
  )
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>{children}</Text>
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>
}
