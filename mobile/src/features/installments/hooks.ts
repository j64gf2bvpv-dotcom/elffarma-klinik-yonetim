import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchInstallmentPlans, createInstallmentPlan, deleteInstallmentPlan, type CreateInstallmentPlanInput, type InstallmentPlanWithCustomer } from './api'
import Toast from 'react-native-toast-message'

export function useInstallmentPlans() {
  return useQuery({ queryKey: ['payment_installment_plans'], queryFn: fetchInstallmentPlans })
}

export function useCreateInstallmentPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInstallmentPlanInput) => createInstallmentPlan(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment_installment_plans'] })
      Toast.show({ type: 'success', text1: 'Taksit planı oluşturuldu' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Plan oluşturulamadı' }),
  })
}

export function useDeleteInstallmentPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstallmentPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment_installment_plans'] })
      Toast.show({ type: 'success', text1: 'Plan silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}

export type { InstallmentPlanWithCustomer }
