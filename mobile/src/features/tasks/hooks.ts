import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyTasks, updateTaskStatus, fetchTasks, createTask, deleteTask, type CreateTaskInput, type TaskWithCustomer } from './api'
import type { TaskStatus } from '@shared/types/database'
import Toast from 'react-native-toast-message'
import { scheduleTaskNotification, cancelTaskNotification } from '@/features/notifications/localNotifications'

export function useMyTasks() {
  return useQuery({ queryKey: ['tasks', 'mine'], queryFn: fetchMyTasks })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (status === 'tamamlandi' || status === 'iptal') cancelTaskNotification(id)
    },
  })
}

export function useTasks(status?: TaskStatus | 'all') {
  return useQuery({ queryKey: ['tasks', status], queryFn: () => fetchTasks(status) })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (created, input) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      Toast.show({ type: 'success', text1: 'Görev oluşturuldu' })
      scheduleTaskNotification(created.id, input.title, input.due_date ?? null)
    },
    onError: () => Toast.show({ type: 'error', text1: 'Görev oluşturulamadı' }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      Toast.show({ type: 'success', text1: 'Görev silindi' })
      cancelTaskNotification(id)
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}

export type { TaskWithCustomer }
