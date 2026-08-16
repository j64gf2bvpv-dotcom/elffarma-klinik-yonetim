import * as React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
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
      {/* KeyboardAvoidingView olmadan, alttaki bir TextField'a (ör. Notlar)
          dokununca klavye içeriğin üzerine biniyor, yazılan yer görünmüyordu —
          "padding" davranışı içeriği klavye kadar yukarı iter. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, style]}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // minHeight: 0 — react-native-web bu View'ları gerçek CSS flexbox'a
  // çeviriyor; CSS'te flex öğelerinin varsayılan min-height'ı "auto"
  // olduğundan, içindeki bir FlatList flex:1 verilse bile bu satır
  // olmadan içerik boyutuna göre büyüyüp taşıyor, kaydırma çalışmıyordu
  // (kullanıcı isteğiyle bulunan gerçek kaydırma hatası, 2026-08-17).
  content: { flexGrow: 1, minHeight: 0, padding: 16 },
})
