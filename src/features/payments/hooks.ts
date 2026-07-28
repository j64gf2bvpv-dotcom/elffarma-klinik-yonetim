import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createPayment,
  deletePayment,
  fetchPayments,
  saveInvoiceInfo,
  uploadInvoiceFile,
  type PaymentFilters,
  type PaymentInput,
  type PaymentWithCustomer,
} from './api'

export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => fetchPayments(filters),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentInput) => createPayment(input),
    onSuccess: (created) => {
      queryClient.setQueriesData<PaymentWithCustomer[]>({ queryKey: ['payments'] }, (old) => [
        { ...created, customers: null, sales_reps: null },
        ...(old ?? []),
      ])
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Tahsilat kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<PaymentWithCustomer[]>({ queryKey: ['payments'] }, (old) =>
        old?.filter((p) => p.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Tahsilat silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useSaveInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      paymentId,
      invoiceNumber,
      file,
    }: {
      paymentId: string
      invoiceNumber: string | null
      file: File | null
    }) => {
      const invoice_file_path = file ? await uploadInvoiceFile(paymentId, file) : undefined
      await saveInvoiceInfo(paymentId, {
        invoice_number: invoiceNumber,
        ...(invoice_file_path !== undefined ? { invoice_file_path } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Fatura bilgisi kaydedildi')
    },
    onError: (error: Error) => toast.error('Kaydedilemedi', { description: error.message }),
  })
}
