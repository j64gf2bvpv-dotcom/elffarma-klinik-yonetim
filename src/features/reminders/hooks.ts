import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchReminders, createReminder, updateReminder, deleteReminder, type ReminderInput } from './api'
import type { Reminder } from '@/types/database'

export function useReminders() {
  return useQuery({ queryKey: ['reminders'], queryFn: fetchReminders })
}

export function useCreateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReminderInput) => createReminder(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Reminder[]>(['reminders'], (old) => [...(old ?? []), created])
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Hatırlatma eklendi')
    },
    onError: (error: Error) => toast.error('Eklenemedi', { description: error.message }),
  })
}

export function useUpdateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ReminderInput> }) => updateReminder(id, input),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<Reminder[]>(['reminders'], (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      )
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
}

export function useDeleteReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Reminder[]>(['reminders'], (old) => old?.filter((r) => r.id !== id))
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Hatırlatma silindi')
    },
    onError: (error: Error) => toast.error('Silinemedi', { description: error.message }),
  })
}
