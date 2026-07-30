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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { useSalesReps } from '@/features/salesReps/hooks'
import { useCreateCrmActivity } from './hooks'
import { tr } from '@/i18n/tr'

const NO_REP = '__none__'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const schema = z.object({
  customer_id: z.string().min(1, 'Doktor seçin'),
  activity_type: z.enum(['arama', 'whatsapp', 'email', 'toplanti', 'video_gorusme', 'not']),
  subject: z.string().optional(),
  note: z.string().optional(),
  occurred_at: z.string().min(1),
  follow_up_date: z.string().optional(),
  sales_rep_id: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function CrmActivityForm({ defaultCustomerId }: { defaultCustomerId?: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCrmActivity()
  const { data: salesReps = [] } = useSalesReps()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: defaultCustomerId ?? '',
      activity_type: 'arama',
      subject: '',
      note: '',
      occurred_at: nowLocal(),
      follow_up_date: '',
      sales_rep_id: NO_REP,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: defaultCustomerId ?? '',
        activity_type: 'arama',
        subject: '',
        note: '',
        occurred_at: nowLocal(),
        follow_up_date: '',
        sales_rep_id: NO_REP,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCustomerId])

  async function onSubmit(values: FormValues) {
    await createMutation.mutateAsync({
      customer_id: values.customer_id,
      activity_type: values.activity_type,
      subject: values.subject || null,
      note: values.note || null,
      occurred_at: new Date(values.occurred_at).toISOString(),
      follow_up_date: values.follow_up_date || null,
      sales_rep_id: values.sales_rep_id && values.sales_rep_id !== NO_REP ? values.sales_rep_id : null,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" /> Aktivite Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni CRM Aktivitesi</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {!defaultCustomerId && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doktor</FormLabel>
                    <FormControl>
                      <CustomerCombobox value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="activity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tür</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(tr.crmActivityType).map(([value, label]) => (
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
                name="occurred_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarih/Saat</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Konu (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="follow_up_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Takip Tarihi (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sales_rep_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temsilci (opsiyonel)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_REP}>Belirtilmedi</SelectItem>
                        {salesReps.map((rep) => (
                          <SelectItem key={rep.id} value={rep.id}>
                            {rep.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Takip tarihi girilirse otomatik olarak Hatırlatmalar'a eklenir.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
