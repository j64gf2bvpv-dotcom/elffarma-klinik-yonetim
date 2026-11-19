import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { tr } from '@/i18n/tr'
import { useCreateExpense, useUpdateExpense } from './hooks'
import type { Expense } from '@/types/database'

const schema = z.object({
  category: z.enum(['hizmet_gideri', 'diger']),
  amount: z.coerce.number().positive('Tutar 0’dan büyük olmalı'),
  description: z.string().optional(),
  expense_date: z.string().min(1),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function todayLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Yeni gider; `expense` verilirse o kaydı düzenler (2026-11-19), `trigger` ile kendi düğmesi */
export function ExpenseForm({ defaultCategory, expense, trigger }: { defaultCategory?: 'hizmet_gideri' | 'diger'; expense?: Expense; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()
  const saving = createMutation.isPending || updateMutation.isPending
  const toLocalInput = (iso: string) => {
    const d = new Date(iso)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? {
          category: expense.category as 'hizmet_gideri' | 'diger',
          amount: Number(expense.amount),
          description: expense.description ?? '',
          expense_date: toLocalInput(expense.expense_date),
        }
      : {
          category: defaultCategory ?? 'hizmet_gideri',
          amount: 0,
          description: '',
          expense_date: todayLocal(),
        },
  })

  async function onSubmit(values: FormOutput) {
    const input = {
      category: values.category,
      amount: values.amount,
      description: values.description || null,
      expense_date: new Date(values.expense_date).toISOString(),
    }
    if (expense) {
      await updateMutation.mutateAsync({ id: expense.id, input })
      setOpen(false)
      return
    }
    await createMutation.mutateAsync(input)
    form.reset({
      category: defaultCategory ?? 'hizmet_gideri',
      amount: 0,
      description: '',
      expense_date: todayLocal(),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni Gider
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? 'Gideri Düzenle' : 'Yeni Gider'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(tr.expenseCategory).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tutar</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expense_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarih</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama (opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Ör. kira, kargo, ofis malzemesi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
