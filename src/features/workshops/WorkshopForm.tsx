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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCongresses } from '@/features/congresses/hooks'
import { useCreateWorkshop, useUpdateWorkshop } from './hooks'
import type { Workshop } from '@/types/database'

const NO_CONGRESS = '__none__'

const schema = z.object({
  name: z.string().min(2, 'Workshop adı gerekli'),
  congress_id: z.string().optional(),
  workshop_date: z.string().optional(),
  location: z.string().optional(),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toDefaults(workshop?: Workshop): FormInput {
  return {
    name: workshop?.name ?? '',
    congress_id: workshop?.congress_id ?? NO_CONGRESS,
    workshop_date: workshop?.workshop_date ?? '',
    location: workshop?.location ?? '',
    cost: workshop?.cost ?? undefined,
    notes: workshop?.notes ?? '',
  }
}

export function WorkshopForm({ workshop, defaultCongressId }: { workshop?: Workshop; defaultCongressId?: string }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateWorkshop()
  const updateMutation = useUpdateWorkshop()
  const { data: congresses = [] } = useCongresses()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: workshop ? toDefaults(workshop) : { ...toDefaults(), congress_id: defaultCongressId ?? NO_CONGRESS },
  })

  React.useEffect(() => {
    if (open) form.reset(workshop ? toDefaults(workshop) : { ...toDefaults(), congress_id: defaultCongressId ?? NO_CONGRESS })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormOutput) {
    const input = {
      name: values.name,
      congress_id: values.congress_id && values.congress_id !== NO_CONGRESS ? values.congress_id : null,
      workshop_date: values.workshop_date || null,
      location: values.location || null,
      cost: values.cost ?? null,
      notes: values.notes || null,
    }
    if (workshop) {
      await updateMutation.mutateAsync({ id: workshop.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {workshop ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus /> Yeni Workshop
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workshop ? 'Workshopu Düzenle' : 'Yeni Workshop'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workshop Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="İleri Enjeksiyon Teknikleri" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="congress_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bağlı Olduğu Kongre (opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CONGRESS}>Bağımsız Workshop</SelectItem>
                      {congresses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="workshop_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarih (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yer (opsiyonel)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maliyet (opsiyonel)</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
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
