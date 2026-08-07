import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyTasks, updateTaskStatus } from './api'
import type { TaskStatus } from '@shared/types/database'

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
