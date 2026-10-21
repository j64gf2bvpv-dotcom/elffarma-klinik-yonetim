import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { offlineUpsert } from '@/lib/offlineMutation'
import type { DoctorAccountOverride } from '@/types/database'

/**
 * Doktor Hesapları tablosundaki Aldığı / Alacağı / Toplam Tutar / Ödenen
 * hücrelerine elle girilen değerler (kullanıcı isteği, 2026-10-21). Değer
 * null'a çekilince o hücre yeniden otomatik hesaplanır. Satış/tahsilat
 * kayıtlarına ve Cari Hesap'a dokunmaz.
 */
export type OverrideField = 'bought_qty' | 'pending_qty' | 'total_amount' | 'paid_amount'

export async function fetchDoctorAccountOverrides(): Promise<DoctorAccountOverride[]> {
  const { data, error } = await supabase.from('doctor_account_overrides').select('*')
  if (error) throw error
  return data as DoctorAccountOverride[]
}

export async function saveDoctorAccountOverride(customerId: string, patch: Partial<Record<OverrideField, number | null>>) {
  return offlineUpsert<DoctorAccountOverride>(
    'doctor_account_overrides',
    { customer_id: customerId, ...patch, updated_at: new Date().toISOString() },
    'Doktor hesabı elle düzenleme',
    'customer_id',
  )
}

export function useDoctorAccountOverrides() {
  return useQuery({ queryKey: ['doctor_account_overrides'], queryFn: fetchDoctorAccountOverrides })
}

export function useSaveDoctorAccountOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, patch }: { customerId: string; patch: Partial<Record<OverrideField, number | null>> }) =>
      saveDoctorAccountOverride(customerId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctor_account_overrides'] }),
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
