// Masaüstündeki src/features/tasks/api.ts'in mobil alt kümesi.
// Dashboard'un "Görevlerim" kartı için fetchMyTasks + tam CRUD (Tasks ekranı için).
import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineUpdate, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Task, TaskStatus, TaskPriority } from '@shared/types/database'

export interface TaskWithCustomer extends Task {
  customer_name: string | null
  assigned_to_name: string | null
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  priority?: TaskPriority
  due_date?: string | null
  customer_id?: string | null
  assigned_to?: string | null
}

export async function fetchMyTasks(): Promise<Task[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .not('status', 'in', '(tamamlandi,iptal)')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Task[]
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const patch: { status: TaskStatus; completed_at?: string | null } = { status }
  patch.completed_at = status === 'tamamlandi' ? new Date().toISOString() : null
  return offlineUpdate<Task>('tasks', id, patch, 'Görev durumu güncelleme')
}

export async function fetchTasks(status?: TaskStatus | 'all'): Promise<TaskWithCustomer[]> {
  let query = supabase
    .from('tasks')
    .select('*, customers(full_name), staff:assigned_to(full_name)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    customer_name: (r as { customers?: { full_name: string | null } }).customers?.full_name ?? null,
    assigned_to_name: (r as { staff?: { full_name: string | null } }).staff?.full_name ?? null,
  })) as TaskWithCustomer[]
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const userId = await getCurrentUserId()
  return offlineInsert<Task>('tasks', {
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? 'normal',
    due_date: input.due_date ?? null,
    customer_id: input.customer_id ?? null,
    assigned_to: input.assigned_to ?? null,
    created_by: userId,
  }, `Görev: ${input.title}`)
}

export async function deleteTask(id: string): Promise<void> {
  return offlineDelete('tasks', id, 'Görev silme')
}
