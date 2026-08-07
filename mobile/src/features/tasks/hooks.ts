import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyTasks, updateTaskStatus, fetchTasks, createTask, deleteTask, type CreateTaskInput, type TaskWithCustomer } from './api'
import type { TaskStatus } from '@shared/types/database'
import Toast from 'react-native-toast-message'

export function useMyTasks() {
  return useQuery({ queryKey: ['tasks', 'mine'], queryFn: fetchMyTasks })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useTasks(status?: TaskStatus | 'all') {
  return useQuery({ queryKey: ['tasks', status], queryFn: () => fetchTasks(status) })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      Toast.show({ type: 'success', text1: 'Görev oluşturuldu' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Görev oluşturulamadı' }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      Toast.show({ type: 'success', text1: 'Görev silindi' })
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}

export type { TaskWithCustomer }
