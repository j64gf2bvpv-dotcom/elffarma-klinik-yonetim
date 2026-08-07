import * as React from 'react'
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
import type { RefreshControlProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/ThemeContext'

/** Masaüstündeki AppShell'in <main> arka plan + safe-area sarmalayıcısının
 * mobil karşılığı — her ekran bunun içine yerleşir. `scroll` verilince
 * içerik bir ScrollView'a sarılır; `refreshControl` sadece bu modda geçerli
 * (liste ekranları genelde kendi FlatList'ine refreshControl verip Screen'i
 * scroll=false kullanır — bkz. CariHesapListScreen/StockListScreen). */
export function Screen({
  children,
  style,
  scroll,
  refreshControl,
}: {
  children: React.ReactNode
  style?: ViewStyle
  scroll?: boolean
  refreshControl?: React.ReactElement<RefreshControlProps>
}) {
  const theme = useTheme()
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]} refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, style]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 16 },
})
