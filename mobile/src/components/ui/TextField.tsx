import * as React from 'react'
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { useTheme } from '@/lib/ThemeContext'

export function TextField({
  label,
  error,
  containerStyle,
  style,
  ...inputProps
}: TextInputProps & { label?: string; error?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label && <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, fontWeight: '500' }}>{label}</Text>}
      <TextInput
        placeholderTextColor={theme.colors.mutedForeground}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.input,
            borderColor: error ? theme.colors.destructive : theme.colors.border,
            color: theme.colors.foreground,
            borderRadius: theme.radius.md,
          },
          style,
        ]}
        {...inputProps}
      />
      {error && <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.xs }}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  input: { height: 44, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
})
