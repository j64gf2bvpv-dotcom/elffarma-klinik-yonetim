import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import { createReminder, updateReminder, deleteReminder } from '@/features/reminders/api'
import { recordStockMovement } from '@/features/stock/api'
import type { CargoShipment, CargoStatus } from '@/types/database'

export interface CargoShipmentInput {
  customer_id?: string | null
  recipient_name: string
  phone?: string | null
  address?: string | null
  product_id?: string | null
  product_name: string
  quantity: number
  ship_date?: string | null
  note?: string | null
}

export async function fetchCargoShipments(): Promise<CargoShipment[]> {
  const { data, error } = await supabase
    .from('cargo_shipments')
    .select('*')
    .order('status', { ascending: true })
    .order('ship_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as CargoShipment[]
}

/**
 * Gönderim tarihi girilirse Hatırlatmalar'da da (dolayısıyla Ajanda'da)
 * görünsün diye bağlı bir hatırlatma da oluşturuluyor — kargo silinirse ya da
 * tarihi kaldırılırsa bu hatırlatma da temizleniyor (reminder_id ile takip
 * edilir, bkz. updateCargoShipment/deleteCargoShipment).
 */
export async function createCargoShipment(input: CargoShipmentInput): Promise<CargoShipment> {
  const createdBy = await getCurrentUserId()
  let reminderId: string | null = null
  if (input.ship_date) {
    const reminder = await createReminder({
      title: `Kargo: ${input.recipient_name} — ${input.product_name}`,
      note: [input.address, input.phone].filter(Boolean).join(' · ') || null,
      due_date: input.ship_date,
    })
    reminderId = reminder.id
  }
  return offlineInsert<CargoShipment>(
    'cargo_shipments',
    { ...input, created_by: createdBy, reminder_id: reminderId },
    `Kargo: ${input.recipient_name}`,
  )
}

export async function updateCargoShipment(id: string, input: Partial<CargoShipmentInput>): Promise<CargoShipment> {
  return offlineUpdate<CargoShipment>('cargo_shipments', id, { ...input }, 'Kargo güncelleme')
}

/**
 * "Gönderildi" olarak işaretlemek — ürün bağlıysa (product_id) stoktan
 * gerçek bir çıkış hareketi olarak düşülür (CLAUDE.md kuralı: current_quantity
 * sadece record_stock_movement RPC'si üzerinden değişir). Sadece
 * 'bekletiliyor'/'gonderilecek' → 'gonderildi' geçişinde çağrılmalı — aynı
 * kargoyu iki kez "gönderildi" yapmak stoktan iki kez düşürmesin diye çağıran
 * taraf (hooks.ts) zaten-gönderilmiş bir kaydı tekrar göndermiyor.
 */
export async function markCargoShipped(shipment: CargoShipment): Promise<CargoShipment> {
  if (shipment.product_id) {
    await recordStockMovement({
      product_id: shipment.product_id,
      movement_type: 'out',
      quantity: shipment.quantity,
      reason: 'Kargo gönderimi',
      customer_id: shipment.customer_id,
      note: `${shipment.recipient_name} adresine kargo`,
    })
  }
  return offlineUpdate<CargoShipment>(
    'cargo_shipments',
    shipment.id,
    { status: 'gonderildi' as CargoStatus, shipped_at: new Date().toISOString() },
    'Kargo gönderildi işaretleme',
  )
}

export async function updateCargoShipmentStatus(id: string, status: CargoStatus): Promise<CargoShipment> {
  return offlineUpdate<CargoShipment>('cargo_shipments', id, { status }, 'Kargo durumu güncelleme')
}

export async function deleteCargoShipment(shipment: CargoShipment): Promise<void> {
  if (shipment.reminder_id) {
    await deleteReminder(shipment.reminder_id).catch(() => {})
  }
  return offlineDelete('cargo_shipments', shipment.id, 'Kargo silme')
}

/** Kargonun gönderim tarihi değiştiğinde bağlı hatırlatmanın tarihini de günceller. */
export async function syncCargoReminderDate(reminderId: string, dueDate: string): Promise<void> {
  await updateReminder(reminderId, { due_date: dueDate })
}
