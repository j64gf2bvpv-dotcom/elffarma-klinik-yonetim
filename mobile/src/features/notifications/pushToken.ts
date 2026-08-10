// Expo push token kaydı — supabase/schema.sql "45. PUSH BİLDİRİM TOKEN'I"
// (staff.expo_push_token). Bu sürümde token sadece toplanıyor; uzaktan push
// gönderen sunucu taraflı bileşen (Supabase Edge Function + Expo Push API)
// ayrı bir faz. Görev/takip bildirimleri şimdilik localNotifications.ts'teki
// cihaz-üzerinde zamanlanmış bildirimlerle çalışıyor.
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabaseClient'
import { getCurrentUserId } from '@/lib/offlineMutation'

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { data } = await Notifications.getExpoPushTokenAsync()
  const token = data
  const userId = await getCurrentUserId()
  if (userId) {
    await supabase.from('staff').update({ expo_push_token: token }).eq('id', userId)
  }
  return token
}
