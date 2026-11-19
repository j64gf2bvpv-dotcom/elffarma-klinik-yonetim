import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { offlineDelete, offlineUpsert } from '@/lib/offlineMutation'

/**
 * Temsilci cirosunun elle girilen tutarı (kullanıcı isteği, 2026-11-19: "satış ciro kısmında buton olsun manuel
 * girebilelim her satışçıda"). Dönem: 'week' (haftanın pazartesisi) ya da 'month' (ayın 1'i). Girilmişse
 * tahsilatlardan hesaplanan cironun yerine gösterilir; silinince otomatik hesaba döner.
 */
export interface ManualRevenue {
  id: string
  sales_rep_id: string
  period_type: 'week' | 'month'
  period_start: string
  amount: number
}

const KEY = ['sales_rep_manual_revenue']

export function useManualRevenue() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_rep_manual_revenue').select('id, sales_rep_id, period_type, period_start, amount')
      if (error) throw error
      return (data ?? []) as ManualRevenue[]
    },
  })
}

export function findManualRevenue(list: ManualRevenue[], repId: string, type: 'week' | 'month', periodStart: string): ManualRevenue | undefined {
  return list.find((m) => m.sales_rep_id === repId && m.period_type === type && m.period_start === periodStart)
}

export function useSetManualRevenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { existingId?: string; sales_rep_id: string; period_type: 'week' | 'month'; period_start: string; amount: number | null }) => {
      if (input.amount == null) {
        if (input.existingId) await offlineDelete('sales_rep_manual_revenue', input.existingId, 'Elle ciro silme')
        return
      }
      await offlineUpsert(
        'sales_rep_manual_revenue',
        { sales_rep_id: input.sales_rep_id, period_type: input.period_type, period_start: input.period_start, amount: input.amount, updated_at: new Date().toISOString() },
        'Elle ciro girişi',
        'sales_rep_id,period_type,period_start',
      )
    },
    onSuccess: (_d, input) => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      toast.success(input.amount == null ? 'Ciro otomatik hesaba döndü' : 'Ciro kaydedildi')
    },
    onError: (error: Error) => toast.error('Ciro kaydedilemedi', { description: error.message }),
  })
}
