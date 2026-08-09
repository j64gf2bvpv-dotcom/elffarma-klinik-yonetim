import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCompetitorReports, createCompetitorReport, deleteCompetitorReport, type CreateCompetitorReportInput } from './api'
import Toast from 'react-native-toast-message'

export function useCompetitorReports() {
  return useQuery({ queryKey: ['competitor_reports'], queryFn: fetchCompetitorReports })
}

export function useCreateCompetitorReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCompetitorReportInput) => createCompetitorReport(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitor_reports'] })
      Toast.show({ type: 'success', text1: 'Rapor kaydedildi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Rapor kaydedilemedi' }),
  })
}

export function useDeleteCompetitorReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCompetitorReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitor_reports'] })
      Toast.show({ type: 'success', text1: 'Rapor silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
