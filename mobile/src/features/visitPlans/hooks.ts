import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toast from 'react-native-toast-message'
import {
  fetchVisitPlans,
  createVisitPlan,
  updateVisitPlanStatus,
  deleteVisitPlan,
  type CreateVisitPlanInput,
} from './api'
import type { VisitPlanStatus } from '@shared/types/database'

export function useVisitPlans(from: string, to: string) {
  return useQuery({ queryKey: ['visit_plans', from, to], queryFn: () => fetchVisitPlans(from, to) })
}

export function useCreateVisitPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVisitPlanInput) => createVisitPlan(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit_plans'] })
      Toast.show({ type: 'success', text1: 'Plan eklendi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Eklenemedi', text2: error.message }),
  })
}

export function useUpdateVisitPlanStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VisitPlanStatus }) => updateVisitPlanStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visit_plans'] }),
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Güncellenemedi', text2: error.message }),
  })
}

export function useDeleteVisitPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVisitPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit_plans'] })
      Toast.show({ type: 'success', text1: 'Plan silindi' })
    },
    onError: (error: Error) => Toast.show({ type: 'error', text1: 'Silinemedi', text2: error.message }),
  })
}
