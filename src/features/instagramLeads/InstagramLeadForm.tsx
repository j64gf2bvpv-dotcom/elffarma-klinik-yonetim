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
import { useCreateInstagramLead, useUpdateInstagramLead } from './hooks'
import type { InstagramLead } from '@/types/database'

const schema = z.object({
  full_name: z.string().min(2, 'İsim gerekli'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  instagram_username: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function defaults(lead?: InstagramLead): FormValues {
  return {
    full_name: lead?.full_name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    address: lead?.address ?? '',
    instagram_username: lead?.instagram_username ?? '',
    notes: lead?.notes ?? '',
  }
}

export function InstagramLeadForm({ lead, trigger }: { lead?: InstagramLead; trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateInstagramLead()
  const updateMutation = useUpdateInstagramLead()

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(lead) })

  React.useEffect(() => {
    if (open) form.reset(defaults(lead))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    const input = {
      full_name: values.full_name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      instagram_username: values.instagram_username || null,
      notes: values.notes || null,
    }
    if (lead) {
      await updateMutation.mutateAsync({ id: lead.id, input })
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
          (lead ? (
            <Button variant="ghost" size="icon">
              <Pencil className="size-4" />
            </Button>
          ) : (
            <Button>
              <Plus /> Doktor Ekle
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lead ? 'Doktoru Düzenle' : 'Instagram\'dan Doktor Ekle'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İsim</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Örn. Ayşe Yılmaz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagram_username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram kullanıcı adı</FormLabel>
                  <FormControl>
                    <Input placeholder="@kullaniciadi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input placeholder="05xx xxx xx xx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ornek@eposta.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres</FormLabel>
                  <FormControl>
                    <Input placeholder="Klinik/adres" {...field} />
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
