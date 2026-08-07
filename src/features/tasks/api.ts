import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Task, TaskStatus, TaskPriority } from '@/types/database'

export type TaskWithRelations = Task & {
  customers: { full_name: string } | null
  assignee: { full_name: string } | null
}

export interface TaskFilters {
  customerId?: string
}

export async function fetchTasks(filters: TaskFilters = {}): Promise<TaskWithRelations[]> {
  let query = supabase
    .from('tasks')
    .select('*, customers(full_name), assignee:staff!tasks_assigned_to_fkey(full_name)')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as TaskWithRelations[]
}

export interface TaskInput {
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  assigned_to?: string | null
  customer_id?: string | null
}

export async function createTask(input: TaskInput): Promise<Task> {
  const createdBy = await getCurrentUserId()
  return offlineInsert<Task>('tasks', { ...input, created_by: createdBy }, `Görev: ${input.title}`)
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const patch: Partial<TaskInput> & { completed_at?: string | null } = { ...input }
  if (input.status === 'tamamlandi') patch.completed_at = new Date().toISOString()
  else if (input.status) patch.completed_at = null
  return offlineUpdate<Task>('tasks', id, patch, `Görev güncelleme: ${input.title ?? ''}`)
}

export async function deleteTask(id: string): Promise<void> {
  return offlineDelete('tasks', id, 'Görev silme')
}
