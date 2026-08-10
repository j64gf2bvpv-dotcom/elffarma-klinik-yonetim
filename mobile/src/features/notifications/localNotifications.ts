// Master talimat §53'teki bildirim örneklerinin ("Dr. Ahmet'in takibi
// bugün", "3 doktorun takibi gecikti") cihaz-üzerinde çalışan sürümü —
// sunucu gerektirmez, expo-notifications'ın yerel zamanlanmış bildirim
// API'sini kullanır. Her görev/hatırlatma/takip kaydı kendi bildirim
// kimliğiyle (identifier) eşleşir; kayıt silinince veya tarihi değişince
// eski zamanlama iptal edilip gerekiyorsa yenisi kurulur — aynı kayıt için
// asla birden fazla bildirim birikmez.
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function idFor(kind: 'task' | 'reminder' | 'visit', recordId: string) {
  return `${kind}-${recordId}`
}

async function scheduleAt(identifier: string, title: string, body: string, date: Date) {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)
  // Geçmiş bir tarih için zamanlama kurulamaz — expo-notifications anında
  // tetikler, bu da "kayıt oluşturuldu" anında sahte bir bildirime yol açar.
  if (date.getTime() <= Date.now()) return
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: Platform.OS === 'ios' ? 'default' : undefined },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  })
}

async function cancel(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)
}

/** Görev son tarihinde (saat 09:00, gün-only due_date'ler için) bildirim kurar. */
export async function scheduleTaskNotification(taskId: string, title: string, dueDate: string | null) {
  const identifier = idFor('task', taskId)
  if (!dueDate) return cancel(identifier)
  const date = new Date(`${dueDate}T09:00:00`)
  await scheduleAt(identifier, 'Görev zamanı geldi', title, date)
}

export async function cancelTaskNotification(taskId: string) {
  await cancel(idFor('task', taskId))
}

/** Hatırlatma vade tarihinde (saat 09:00) bildirim kurar. */
export async function scheduleReminderNotification(reminderId: string, title: string, dueDate: string | null) {
  const identifier = idFor('reminder', reminderId)
  if (!dueDate) return cancel(identifier)
  const date = new Date(`${dueDate}T09:00:00`)
  await scheduleAt(identifier, 'Hatırlatma', title, date)
}

export async function cancelReminderNotification(reminderId: string) {
  await cancel(idFor('reminder', reminderId))
}

/** Doktor ziyaret takibi (next_visit_date, saat 09:00) için bildirim kurar. */
export async function scheduleVisitFollowUpNotification(visitId: string, doctorName: string, nextVisitDate: string | null) {
  const identifier = idFor('visit', visitId)
  if (!nextVisitDate) return cancel(identifier)
  const date = new Date(`${nextVisitDate}T09:00:00`)
  await scheduleAt(identifier, 'Doktor takibi', `${doctorName} için takip zamanı geldi`, date)
}

export async function cancelVisitFollowUpNotification(visitId: string) {
  await cancel(idFor('visit', visitId))
}
