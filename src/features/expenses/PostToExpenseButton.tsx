import { Receipt, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useExpenses, useCreateExpense } from './hooks'
import type { ExpenseCategory } from '@/types/database'

interface PostToExpenseButtonProps {
  category: ExpenseCategory
  amount: number
  description: string
  congressId?: string
  workshopId?: string
}

/** Kongre/workshop maliyetini tek tıkla gerçek bir gider kaydına dönüştürür; aynı
 * kategori için zaten bir kayıt varsa tekrar oluşturmayı engeller (yinelenen gider kaydı riski). */
export function PostToExpenseButton({ category, amount, description, congressId, workshopId }: PostToExpenseButtonProps) {
  const { data: existing = [] } = useExpenses({ congressId, workshopId })
  const createMutation = useCreateExpense()
  const alreadyPosted = existing.some((e) => e.category === category)

  if (amount <= 0) return null

  if (alreadyPosted) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <CheckCircle2 className="text-success size-3.5" /> Gidere İşlendi
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={createMutation.isPending}
      onClick={() =>
        createMutation.mutate({
          category,
          amount,
          description,
          expense_date: new Date().toISOString(),
          congress_id: congressId ?? null,
          workshop_id: workshopId ?? null,
        })
      }
    >
      {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Receipt className="size-3.5" />}
      Gidere İşle
    </Button>
  )
}
