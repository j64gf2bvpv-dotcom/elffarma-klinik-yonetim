import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Reminder } from '@/types/database'

export interface ReminderInput {
  title: string
  note?: string | null
  due_date: string
  is_done?: boolean
}

export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase.from('reminders').select('*').order('due_date', { ascending: true })
  if (error) throw error
  return data as Reminder[]
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Reminder>('reminders', { ...input, created_by: createdBy }, `Hatırlatma: ${input.title}`)
}

export async function updateReminder(id: string, input: Partial<ReminderInput>): Promise<Reminder> {
  return offlineUpdate<Reminder>('reminders', id, { ...input }, `Hatırlatma güncelleme`)
}

export async function deleteReminder(id: string): Promise<void> {
  return offlineDelete('reminders', id, 'Hatırlatma silme')
}
