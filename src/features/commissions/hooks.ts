import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCommissionAdjustment,
  createCommissionRule,
  deleteCommissionAdjustment,
  deleteCommissionRule,
  fetchCommissionAdjustments,
  fetchCommissionRules,
  updateCommissionRule,
  type AdjustmentWithRep,
  type CommissionAdjustmentInput,
  type CommissionRuleInput,
} from './api'
import type { CommissionRule } from '@/types/database'

export function useCommissionRules() {
  return useQuery({ queryKey: ['commission_rules'], queryFn: fetchCommissionRules })
}

export function useCreateCommissionRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CommissionRuleInput) => createCommissionRule(input),
    onSuccess: (created) => {
      queryClient.setQueryData<CommissionRule[]>(['commission_rules'], (old) => (old ? [created, ...old] : old))
      queryClient.invalidateQueries({ queryKey: ['commission_rules'] })
      toast.success('Prim kuralı eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateCommissionRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CommissionRuleInput }) => updateCommissionRule(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<CommissionRule[]>(['commission_rules'], (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      )
      queryClient.invalidateQueries({ queryKey: ['commission_rules'] })
      toast.success('Prim kuralı güncellendi')
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteCommissionRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCommissionRule(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<CommissionRule[]>(['commission_rules'], (old) => old?.filter((r) => r.id !== id))
      queryClient.invalidateQueries({ queryKey: ['commission_rules'] })
      toast.success('Prim kuralı silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}

export function useCommissionAdjustments(from: string, to: string) {
  return useQuery({
    queryKey: ['commission_adjustments', from, to],
    queryFn: () => fetchCommissionAdjustments(from, to),
  })
}

export function useCreateCommissionAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CommissionAdjustmentInput) => createCommissionAdjustment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission_adjustments'] })
      toast.success('Prim düzeltmesi eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useDeleteCommissionAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCommissionAdjustment(id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<AdjustmentWithRep[]>({ queryKey: ['commission_adjustments'] }, (old) =>
        old?.filter((a) => a.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: ['commission_adjustments'] })
      toast.success('Prim düzeltmesi silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
