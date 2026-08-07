// Masaüstündeki src/features/tasks/api.ts'in Faz 1 alt kümesi — Dashboard'daki
// "Görevlerim" kartı için sadece bana atanan açık görevleri okur + durumunu
// günceller (tam CRUD masaüstünde kalıyor).
import { supabase } from '@/lib/supabaseClient'
import { offlineUpdate, getCurrentUserId } from '@/lib/offlineMutation'
import type { Task, TaskStatus } from '@shared/types/database'

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
