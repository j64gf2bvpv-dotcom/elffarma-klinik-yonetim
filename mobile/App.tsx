import 'react-native-gesture-handler'
import * as React from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from '@/lib/ThemeContext'
import { AuthProvider } from '@/lib/auth'
import { OfflineSyncProvider } from '@/features/offline/OfflineSyncContext'
import { RootNavigator } from '@/navigation/RootNavigator'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <OfflineSyncProvider>
                {/* Koyu tema arka planına karşı durum çubuğu ikonları da açık
                    renk olmalı — aksi halde saat/pil/sinyal görünmez olurdu. */}
                <StatusBar style="light" />
                <RootNavigator />
                <Toast />
              </OfflineSyncProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
