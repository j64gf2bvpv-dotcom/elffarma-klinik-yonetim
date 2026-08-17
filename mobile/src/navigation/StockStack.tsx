import * as React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StockScreen } from '@/screens/more/StockScreen'
import type { MoreStackParamList } from './types'

const Stack = createNativeStackNavigator<MoreStackParamList>()

/**
 * Kullanıcı isteğiyle (2026-08-17) Stok, Daha Fazla'nın içinde kalmaya
 * devam ederken alt sekme çubuğuna da (Siparişler'in yanına) kısayol
 * olarak eklendi — StockScreen'in kendisi MoreStackParamList'in 'Stock'
 * rotasına göre tipli olduğu için burada da aynı tip kullanılıyor, ikinci
 * bağımsız bir navigator örneği (route adları sadece kendi navigator'ı
 * içinde benzersiz olmak zorunda, çakışma yok).
 */
export function StockStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Stock" component={StockScreen} />
    </Stack.Navigator>
  )
}
