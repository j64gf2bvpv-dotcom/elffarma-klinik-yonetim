import { subDays, format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { createReminder, updateReminder, deleteReminder } from '@/features/reminders/api'
import type { UtilityBill, UtilityBillCategory, UtilityBillTemplate } from '@/types/database'

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

/** Hatırlatma, son ödeme tarihinin KENDİSİNDE değil bir hafta ÖNCESİNDE düşsün diye (kullanıcı isteğiyle, 2026-08-21) — ödemeye yetişecek zaman kalsın. */
function reminderDueDate(dueDate: string): string {
  return format(subDays(new Date(dueDate), 7), 'yyyy-MM-dd')
}

function reminderTitle(input: UtilityBillInput): string {
  return `${UTILITY_BILL_CATEGORY_LABELS[input.category]} Faturası — Son Ödeme Yaklaşıyor`
}

function reminderNote(input: UtilityBillInput): string {
  const parts = [
    `Son ödeme tarihi: ${format(new Date(input.due_date), 'd MMMM yyyy', { locale: trLocale })}`,
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
    due_date: reminderDueDate(input.due_date),
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
    await updateReminder(reminderId, {
      title: reminderTitle(input),
      note: reminderNote(input),
      due_date: reminderDueDate(input.due_date),
    })
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

export interface UtilityBillTemplateInput {
  category: UtilityBillCategory
  contract_number?: string | null
  amount: number
  day_of_month: number
  note?: string | null
}

export async function fetchUtilityBillTemplates(): Promise<UtilityBillTemplate[]> {
  const { data, error } = await supabase.from('utility_bill_templates').select('*').order('day_of_month', { ascending: true })
  if (error) throw error
  return data as UtilityBillTemplate[]
}

export async function createUtilityBillTemplate(input: UtilityBillTemplateInput): Promise<UtilityBillTemplate> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<UtilityBillTemplate>(
    'utility_bill_templates',
    { ...input, created_by: createdBy },
    `Tekrarlayan fatura: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBillTemplate(id: string, input: UtilityBillTemplateInput): Promise<UtilityBillTemplate> {
  return offlineUpdate<UtilityBillTemplate>(
    'utility_bill_templates',
    id,
    { ...input },
    `Tekrarlayan fatura güncelleme: ${UTILITY_BILL_CATEGORY_LABELS[input.category]}`,
  )
}

export async function updateUtilityBillTemplateActive(id: string, isActive: boolean): Promise<UtilityBillTemplate> {
  return offlineUpdate<UtilityBillTemplate>('utility_bill_templates', id, { is_active: isActive }, 'Tekrarlayan fatura durumu güncelleme')
}

export async function deleteUtilityBillTemplate(id: string): Promise<void> {
  return offlineDelete('utility_bill_templates', id, 'Tekrarlayan fatura şablonu silme')
}
