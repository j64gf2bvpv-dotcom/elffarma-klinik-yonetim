import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Expense, ExpenseCategory } from '@shared/types/database'

export interface CreateExpenseInput {
  category: ExpenseCategory
  amount: number
  description?: string | null
  expense_date: string
}

export async function fetchExpenses(from?: string, to?: string): Promise<Expense[]> {
  let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(200)
  if (from) query = query.gte('expense_date', from)
  if (to) query = query.lte('expense_date', to)
  const { data, error } = await query
  if (error) throw error
  return data as Expense[]
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const userId = await getCurrentUserId()
  return offlineInsert<Expense>('expenses', { ...input, staff_id: userId }, `Gider: ${input.description ?? input.category}`)
}

export async function deleteExpense(id: string): Promise<void> {
  return offlineDelete('expenses', id, 'Gider silme')
}
