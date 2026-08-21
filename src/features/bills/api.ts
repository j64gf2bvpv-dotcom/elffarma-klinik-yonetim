import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { createReminder, updateReminder, deleteReminder } from '@/features/reminders/api'
import type { UtilityBill, UtilityBillCategory } from '@/types/database'

export const UTILITY_BILL_CATEGORY_LABELS: Record<UtilityBillCategory, string> = {
  elektrik: 'Elektrik',
  dogalgaz: 'Doğalgaz',
  su: 'Su',
  internet: 'İnternet',
  telefon: 'Telefon',
  diger: 'Diğer',
}

export interface UtilityBillInput {
  category: UtilityBillCategory
  contract_number?: string | null
  amount: number
  due_date: string
  note?: string | null
}

function reminderTitle(input: UtilityBillInput): string {
  return `${UTILITY_BILL_CATEGORY_LABELS[input.category]} Faturası — Son Ödeme`
}

function reminderNote(input: UtilityBillInput): string {
  const parts = [
    input.contract_number ? `Sözleşme No: ${input.contract_number}` : null,
    `Tutar: ${input.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}`,
    input.note?.trim() || null,
  ]
  return parts.filter(Boolean).join(' — ')
}

export async function fetchUtilityBills(): Promise<UtilityBill[]> {
  const { data, error } = await supabase.from('utility_bills').select('*').order('due_date', { ascending: true })
  if (error) throw error
  return data as UtilityBill[]
}

/** Fatura eklenince son ödeme tarihinde otomatik bir Hatırlatma oluşturulur — ayrı bir bildirim mekanizması kurulmuyor, mevcut zil/Hatırlatmalar/Ajanda bunu otomatik gösterir. */
export async function createUtilityBill(input: UtilityBillInput): Promise<UtilityBill> {
  const reminder = await createReminder({
    title: reminderTitle(input),
    note: reminderNote(input),
    due_date: input.due_date,
  })
  const createdBy = await getCurrentUserId()
  return offlineInsert<UtilityBill>(
    'utility_bills',
    { ...input, reminder_id: reminder.id, created_by: createdBy },
    `Fatura: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBill(id: string, input: UtilityBillInput, reminderId: string | null): Promise<UtilityBill> {
  if (reminderId) {
    await updateReminder(reminderId, { title: reminderTitle(input), note: reminderNote(input), due_date: input.due_date })
  }
  return offlineUpdate<UtilityBill>('utility_bills', id, { ...input }, `Fatura güncelleme: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`)
}

/** Ödendi işaretlenince bağlı hatırlatma da tamamlandı sayılır — ödenmiş bir fatura için zil/Hatırlatmalar artık uyarı vermesin diye. Geri alınırsa hatırlatma da geri açılır. */
export async function updateUtilityBillPaid(id: string, isPaid: boolean, reminderId: string | null): Promise<UtilityBill> {
  if (reminderId) {
    await updateReminder(reminderId, { is_done: isPaid })
  }
  return offlineUpdate<UtilityBill>('utility_bills', id, { is_paid: isPaid }, 'Fatura ödeme durumu güncelleme')
}

export async function deleteUtilityBill(id: string, reminderId: string | null): Promise<void> {
  if (reminderId) {
    await deleteReminder(reminderId)
  }
  return offlineDelete('utility_bills', id, 'Fatura silme')
}
