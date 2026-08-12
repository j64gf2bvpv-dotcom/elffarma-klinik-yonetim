import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  createInstallmentPlan,
  createPayment,
  deleteInstallmentPlan,
  fetchAllInstallments,
  fetchInstallmentPlans,
  fetchPayments,
  getInvoiceFileUrl,
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
      Toast.show({ type: 'success', text1: 'Tahsilat kaydedildi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: error.message }),
  })
}

// Masaüstündeki useSaveInvoice'un mobil karşılığı — dosya varsa (base64)
// önce invoices bucket'ına yükler, sonra fatura no/dosya yolunu payments
// satırına yazar. base64 verilmezse sadece fatura numarası güncellenir.
export function useSaveInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      paymentId,
      invoiceNumber,
      base64,
      ext,
      contentType,
    }: {
      paymentId: string
      invoiceNumber: string | null
      base64?: string | null
      ext?: string
      contentType?: string
    }) => {
      const invoice_file_path = base64 ? await uploadInvoiceFile(paymentId, base64, ext, contentType) : undefined
      await saveInvoiceInfo(paymentId, {
        invoice_number: invoiceNumber,
        ...(invoice_file_path !== undefined ? { invoice_file_path } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      Toast.show({ type: 'success', text1: 'Fatura bilgisi kaydedildi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: error.message }),
  })
}

export function useInvoiceFileUrl() {
  return useMutation({ mutationFn: (path: string) => getInvoiceFileUrl(path) })
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
      Toast.show({ type: 'success', text1: 'Taksit planı oluşturuldu' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Oluşturulamadı', text2: error.message }),
  })
}

export function useDeleteInstallmentPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstallmentPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_installment_plans'] })
      queryClient.invalidateQueries({ queryKey: ['payment_installments'] })
      Toast.show({ type: 'success', text1: 'Taksit planı silindi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Silinemedi', text2: error.message }),
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
      Toast.show({ type: 'success', text1: 'Taksit tahsil edildi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'İşlem başarısız', text2: error.message }),
  })
}
