import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Pencil } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateReminder, useUpdateReminder } from './hooks'
import type { Reminder } from '@/types/database'

const schema = z.object({
  title: z.string().min(2, 'Başlık gerekli'),
  due_date: z.string().min(1, 'Tarih gerekli'),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ReminderForm({ reminder }: { reminder?: Reminder }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateReminder()
  const updateMutation = useUpdateReminder()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: reminder?.title ?? '',
      due_date: reminder?.due_date ?? '',
      note: reminder?.note ?? '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: reminder?.title ?? '',
        due_date: reminder?.due_date ?? '',
        note: reminder?.note ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = { title: values.title, due_date: values.due_date, note: values.note || null }
    if (reminder) {
      await updateMutation.mutateAsync({ id: reminder.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {reminder ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Hatırlatma Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reminder ? 'Hatırlatmayı Düzenle' : 'Yeni Hatırlatma'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Vergi Ödemesi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarih</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Not (opsiyonel)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
