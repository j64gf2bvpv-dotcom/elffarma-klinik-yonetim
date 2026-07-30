import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createInstallmentPlan,
  createPayment,
  deleteInstallmentPlan,
  deletePayment,
  fetchAllInstallments,
  fetchInstallmentPlans,
  fetchPayments,
  markInstallmentPaid,
  saveInvoiceInfo,
  uploadInvoiceFile,
  type InstallmentPlanInput,
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

export function useInstallmentPlans(customerId?: string) {
  return useQuery({
    queryKey: ['payment_installment_plans', customerId],
    queryFn: () => fetchInstallmentPlans(customerId),
  })
}

export function useAllInstallments() {
  return useQuery({ queryKey: ['payment_installments', 'all'], queryFn: fetchAllInstallments })
}

export function useCreateInstallmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstallmentPlanInput) => createInstallmentPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_installment_plans'] })
      queryClient.invalidateQueries({ queryKey: ['payment_installments'] })
      toast.success('Taksit planı oluşturuldu')
    },
    onError: (error: Error) => toast.error('Oluşturulamadı', { description: error.message }),
  })
}

export function useDeleteInstallmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstallmentPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_installment_plans'] })
      queryClient.invalidateQueries({ queryKey: ['payment_installments'] })
      toast.success('Taksit planı silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ installmentId, paymentId }: { installmentId: string; paymentId: string }) =>
      markInstallmentPaid(installmentId, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_installments'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Taksit tahsil edildi')
    },
    onError: (error: Error) => toast.error('İşlem başarısız', { description: error.message }),
  })
}
