import * as React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/ThemeContext'
import { supabase } from '@/lib/supabaseClient'
import { useDeepLinkRecovery } from '@/lib/deepLink'
import { LoginScreen } from '@/screens/auth/LoginScreen'
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen'
import { MainTabs } from './MainTabs'
import { navigationRef } from './navigationRef'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Masaüstündeki App.tsx'in ProtectedRoute + DeepLinkListener mantığının
 * mobil karşılığı. ResetPassword, desktop'taki `/sifre-sifirla` gibi
 * session durumundan BAĞIMSIZ, her zaman erişilebilir bir kök ekran olarak
 * tanımlı — çünkü setSession() başarılı olduğunda `session` dolup RootSwitch
 * Login yerine Main'i seçer hale gelir; ResetPassword'ün AuthNavigator'a
 * gömülü olması bu geçişte navigasyonu kırardı (o an artık mount'lu değil).
 * is_active client-side'da masaüstünde de kontrol edilmiyor — bilinçli
 * olarak burada da eklenmedi (bkz. plan §Context).
 */
function RootNavigatorContent() {
  const { session, loading } = useAuth()
  const theme = useTheme()

  useDeepLinkRecovery(async ({ access_token, refresh_token }) => {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (!error && navigationRef.isReady()) {
      navigationRef.navigate('ResetPassword')
    }
  })

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  )
}

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigatorContent />
    </NavigationContainer>
  )
}
