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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { useStaffList } from '@/features/staff/hooks'
import { useCreateTask, useUpdateTask } from './hooks'
import { tr } from '@/i18n/tr'
import type { TaskWithRelations } from './api'

const NO_ASSIGNEE = '__none__'
const NO_CUSTOMER = '__none__'

const schema = z.object({
  title: z.string().min(2, 'Başlık gerekli'),
  description: z.string().optional(),
  status: z.enum(['bekliyor', 'devam_ediyor', 'tamamlandi', 'iptal']),
  priority: z.enum(['dusuk', 'normal', 'yuksek']),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  customer_id: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface TaskFormProps {
  task?: TaskWithRelations
  defaultCustomerId?: string
  trigger?: React.ReactNode
}

export function TaskForm({ task, defaultCustomerId, trigger }: TaskFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const { data: staff = [] } = useStaffList()

  function defaults(): FormInput {
    return {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'bekliyor',
      priority: task?.priority ?? 'normal',
      due_date: task?.due_date ?? '',
      assigned_to: task?.assigned_to ?? NO_ASSIGNEE,
      customer_id: task?.customer_id ?? defaultCustomerId ?? NO_CUSTOMER,
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })

  React.useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      title: values.title,
      description: values.description || null,
      status: values.status,
      priority: values.priority,
      due_date: values.due_date || null,
      assigned_to: values.assigned_to && values.assigned_to !== NO_ASSIGNEE ? values.assigned_to : null,
      customer_id: values.customer_id && values.customer_id !== NO_CUSTOMER ? values.customer_id : null,
    }
    if (task) {
      await updateMutation.mutateAsync({ id: task.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (task ? (
            <Button variant="ghost" size="icon">
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button>
              <Plus /> Görev Ekle
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Görevi Düzenle' : 'Yeni Görev'}</DialogTitle>
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
                    <Input placeholder="Örn. Dr. Ayşe'yi ara" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durum</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(tr.taskStatus).map(([value, label]) => (
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Öncelik</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(tr.taskPriority).map(([value, label]) => (
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bitiş Tarihi (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atanan Kişi (opsiyonel)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ASSIGNEE}>Belirtilmedi</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!defaultCustomerId && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>İlgili Doktor (opsiyonel)</FormLabel>
                    <FormControl>
                      <CustomerCombobox
                        value={field.value === NO_CUSTOMER ? undefined : field.value}
                        onChange={field.onChange}
                        placeholder="Doktor seçin (opsiyonel)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama (opsiyonel)</FormLabel>
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
