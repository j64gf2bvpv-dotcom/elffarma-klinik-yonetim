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
import { CurrencyInput } from '@/components/ui/currency-input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateCongress, useUpdateCongress } from './hooks'
import type { Congress } from '@/types/database'

const schema = z.object({
  name: z.string().min(2, 'Kongre adı gerekli'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
  will_attend: z.boolean(),
  single_person_price: z.coerce.number().min(0).optional(),
  two_person_price: z.coerce.number().min(0).optional(),
  image_url: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function CongressForm({ congress }: { congress?: Congress }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCongress()
  const updateMutation = useUpdateCongress()

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: congress?.name ?? '',
      start_date: congress?.start_date ?? '',
      end_date: congress?.end_date ?? '',
      notes: congress?.notes ?? '',
      will_attend: congress?.will_attend ?? false,
      single_person_price: congress?.single_person_price ?? undefined,
      two_person_price: congress?.two_person_price ?? undefined,
      image_url: congress?.image_url ?? '',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: congress?.name ?? '',
        start_date: congress?.start_date ?? '',
        end_date: congress?.end_date ?? '',
        notes: congress?.notes ?? '',
        will_attend: congress?.will_attend ?? false,
        single_person_price: congress?.single_person_price ?? undefined,
        two_person_price: congress?.two_person_price ?? undefined,
        image_url: congress?.image_url ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      notes: values.notes || null,
      will_attend: values.will_attend,
      single_person_price: values.single_person_price ?? null,
      two_person_price: values.two_person_price ?? null,
      image_url: values.image_url || null,
    }
    if (congress) {
      await updateMutation.mutateAsync({ id: congress.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {congress ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Yeni Kongre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{congress ? 'Kongreyi Düzenle' : 'Yeni Kongre / Workshop'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kongre / Workshop Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Ekam Kongresi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Başlangıç Tarihi</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
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
            </div>
            <FormField
              control={form.control}
              name="will_attend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">Katılım sağlanacak</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="single_person_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tek Kişi Katılım Fiyatı (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="two_person_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2 Kişi Katılım Fiyatı (opsiyonel)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Görsel URL (opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notlar</FormLabel>
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
