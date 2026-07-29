import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useCreateParticipant, useDeleteParticipant, useUpdateParticipant } from './hooks'
import type { AttendanceStatus, CongressParticipant } from '@/types/database'

const attendanceLabels: Record<AttendanceStatus, string> = {
  registered: 'Kayıtlı / Davetli',
  attended: 'Katıldı',
  no_show: 'Gelmedi',
}

const schema = z.object({
  doctor_name: z.string().min(2, 'Doktor adı gerekli'),
  flight_cost: z.coerce.number().min(0),
  registration_cost: z.coerce.number().min(0),
  accommodation_cost: z.coerce.number().min(0),
  notes: z.string().optional(),
  attendance_status: z.enum(['registered', 'attended', 'no_show']),
  certificate_issued: z.boolean(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function ParticipantDialog({
  congressId,
  participant,
}: {
  congressId: string
  participant?: CongressParticipant
}) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateParticipant()
  const updateMutation = useUpdateParticipant()
  const deleteMutation = useDeleteParticipant()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      doctor_name: participant?.doctor_name ?? '',
      flight_cost: participant?.flight_cost ?? 0,
      registration_cost: participant?.registration_cost ?? 0,
      accommodation_cost: participant?.accommodation_cost ?? 0,
      notes: participant?.notes ?? '',
      attendance_status: participant?.attendance_status ?? 'registered',
      certificate_issued: participant?.certificate_issued ?? false,
    },
  })

  async function onSubmit(values: FormOutput) {
    if (participant) {
      await updateMutation.mutateAsync({ id: participant.id, congressId, input: values })
    } else {
      await createMutation.mutateAsync({ congress_id: congressId, ...values })
    }
    setOpen(false)
  }

  async function handleDelete() {
    if (!participant) return
    await deleteMutation.mutateAsync({ id: participant.id, congressId })
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {participant ? (
          <Button variant="ghost" size="icon">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Doktor Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{participant ? 'Doktor Bilgilerini Düzenle' : 'Yeni Doktor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="doctor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doktor Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Ayşe Yılmaz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="flight_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uçak (₺)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registration_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kayıt (₺)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accommodation_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Konaklama (₺)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="attendance_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yoklama</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(attendanceLabels) as AttendanceStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {attendanceLabels[s]}
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
                name="certificate_issued"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-end gap-2 pb-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="!mt-0">Katılım belgesi verildi</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {participant?.qr_code && (
              <p className="text-muted-foreground text-xs">QR Kayıt Kodu: {participant.qr_code}</p>
            )}
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
            <DialogFooter className="sm:justify-between">
              {participant ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 /> Sil
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  Kaydet
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
