import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReminders, createReminder, updateReminder, deleteReminder, type CreateReminderInput } from './api'
import type { Reminder } from '@shared/types/database'
import Toast from 'react-native-toast-message'
import { scheduleReminderNotification, cancelReminderNotification } from '@/features/notifications/localNotifications'

export function useReminders() {
  return useQuery({ queryKey: ['reminders'], queryFn: fetchReminders })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReminderInput) => createReminder(input),
    onSuccess: (created, input) => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      Toast.show({ type: 'success', text1: 'Hatırlatma eklendi' })
      scheduleReminderNotification(created.id, input.title, input.due_date)
    },
    onError: () => Toast.show({ type: 'error', text1: 'Eklenemedi' }),
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Reminder, 'title' | 'note' | 'due_date' | 'is_done'>> }) =>
      updateReminder(id, patch),
    onSuccess: (_, { id, patch }) => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      if (patch.is_done) cancelReminderNotification(id)
    },
    onError: () => Toast.show({ type: 'error', text1: 'Güncellenemedi' }),
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      cancelReminderNotification(id)
    },
    onError: () => Toast.show({ type: 'error', text1: 'Silinemedi' }),
  })
}
