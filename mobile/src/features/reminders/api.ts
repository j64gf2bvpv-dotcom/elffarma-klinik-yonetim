import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Reminder } from '@shared/types/database'

export interface CreateReminderInput {
  title: string
  note?: string | null
  due_date: string
}

export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true })
    .limit(200)
  if (error) throw error
  return data as Reminder[]
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const userId = await getCurrentUserId()
  return offlineInsert<Reminder>('reminders', { ...input, is_done: false, created_by: userId }, `Hatırlatma: ${input.title}`)
}

export async function updateReminder(id: string, patch: Partial<Pick<Reminder, 'title' | 'note' | 'due_date' | 'is_done'>>): Promise<Reminder> {
  return offlineUpdate<Reminder>('reminders', id, patch, 'Hatırlatma güncelleme')
}

export async function deleteReminder(id: string): Promise<void> {
  return offlineDelete('reminders', id, 'Hatırlatma silme')
}
