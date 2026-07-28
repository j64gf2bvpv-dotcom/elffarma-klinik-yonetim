import { supabase } from '@/lib/supabaseClient'
import { offlineInsert, offlineDelete, getCurrentUserId } from '@/lib/offlineMutation'
import type { Expense, ExpenseCategory } from '@/types/database'

export interface ExpenseInput {
  category: ExpenseCategory
  amount: number
  description?: string | null
  expense_date: string
}

export interface ExpenseFilters {
  from?: string
  to?: string
}

export async function fetchExpenses(filters: ExpenseFilters): Promise<Expense[]> {
  let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false })

  if (filters.from) query = query.gte('expense_date', filters.from)
  if (filters.to) query = query.lte('expense_date', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data as Expense[]
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const staffId = await getCurrentUserId()
  return offlineInsert<Expense>(
    'expenses',
    { ...input, staff_id: staffId },
    `Gider: ${input.amount} TL`,
  )
}

export async function deleteExpense(id: string): Promise<void> {
  return offlineDelete('expenses', id, 'Gider silme')
}
