import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createUtilityBill,
  deleteUtilityBill,
  fetchUtilityBills,
  updateUtilityBill,
  updateUtilityBillPaid,
  type UtilityBillInput,
} from './api'

export function useUtilityBills() {
  return useQuery({ queryKey: ['utility_bills'], queryFn: fetchUtilityBills })
}

function invalidateBillsAndReminders(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['utility_bills'] })
  queryClient.invalidateQueries({ queryKey: ['reminders'] })
}

export function useCreateUtilityBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UtilityBillInput) => createUtilityBill(input),
    onSuccess: () => {
      invalidateBillsAndReminders(queryClient)
      toast.success('Fatura eklendi, son ödeme tarihi için hatırlatma oluşturuldu')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useUpdateUtilityBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
      reminderId,
    }: {
      id: string
      input: UtilityBillInput
      reminderId: string | null
    }) => updateUtilityBill(id, input, reminderId),
    onSuccess: () => {
      invalidateBillsAndReminders(queryClient)
      toast.success('Fatura güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useUpdateUtilityBillPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isPaid, reminderId }: { id: string; isPaid: boolean; reminderId: string | null }) =>
      updateUtilityBillPaid(id, isPaid, reminderId),
    onSuccess: () => {
      invalidateBillsAndReminders(queryClient)
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteUtilityBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reminderId }: { id: string; reminderId: string | null }) => deleteUtilityBill(id, reminderId),
    onSuccess: () => {
      invalidateBillsAndReminders(queryClient)
      toast.success('Fatura silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
