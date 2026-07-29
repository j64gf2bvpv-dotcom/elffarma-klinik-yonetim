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
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ProductCombobox } from '@/features/stock/ProductCombobox'
import { useProducts } from '@/features/stock/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'
import { ClinicCombobox } from '@/features/clinics/ClinicCombobox'
import { CustomerCombobox } from '@/features/customers/CustomerCombobox'
import { useCreateCommissionRule, useUpdateCommissionRule } from './hooks'
import type { CommissionRule, CommissionScopeType } from '@/types/database'

const scopeLabels: Record<CommissionScopeType, string> = {
  all: 'Tümü (Ciro/Tahsilat Bazlı)',
  product: 'Ürün Bazlı',
  category: 'Kategori Bazlı',
  brand: 'Marka Bazlı',
  sales_rep: 'Temsilci Bazlı',
  clinic: 'Klinik Bazlı',
  customer: 'Doktor Bazlı',
}

const schema = z.object({
  name: z.string().min(2, 'Kural adı gerekli'),
  scope_type: z.enum(['all', 'product', 'category', 'brand', 'sales_rep', 'clinic', 'customer']),
  scope_value: z.string().nullable().optional(),
  basis: z.enum(['satis', 'tahsilat']),
  rate_percent: z.coerce.number().min(0).max(100),
  is_active: z.boolean(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface CommissionRuleFormProps {
  rule?: CommissionRule
  trigger?: React.ReactNode
}

export function CommissionRuleForm({ rule, trigger }: CommissionRuleFormProps) {
  const [open, setOpen] = React.useState(false)
  const createMutation = useCreateCommissionRule()
  const updateMutation = useUpdateCommissionRule()
  const { data: products = [] } = useProducts('')
  const { data: salesReps = [] } = useSalesReps()
  const categories = React.useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'tr')),
    [products],
  )

  function defaults(): FormInput {
    return {
      name: rule?.name ?? '',
      scope_type: rule?.scope_type ?? 'all',
      scope_value: rule?.scope_value ?? null,
      basis: rule?.basis ?? 'satis',
      rate_percent: rule?.rate_percent ?? 0,
      is_active: rule?.is_active ?? true,
    }
  }

  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() })

  React.useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const scopeType = form.watch('scope_type')
  const scopeValue = form.watch('scope_value')

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name,
      scope_type: values.scope_type,
      scope_value: values.scope_type === 'all' ? null : values.scope_value || null,
      basis: values.basis,
      rate_percent: values.rate_percent,
      is_active: values.is_active,
    }
    if (rule) {
      await updateMutation.mutateAsync({ id: rule.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    setOpen(false)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni Prim Kuralı
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? 'Prim Kuralını Düzenle' : 'Yeni Prim Kuralı'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kural Adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Dermakor ürünlerinde %5 satış primi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="basis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baz</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        if (v === 'tahsilat' && !['all', 'sales_rep', 'clinic', 'customer'].includes(scopeType)) {
                          form.setValue('scope_type', 'all')
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="satis">Satış</SelectItem>
                        <SelectItem value="tahsilat">Tahsilat</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rate_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oran (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" max="100" {...field} value={field.value as number | string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="scope_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapsam</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      form.setValue('scope_value', null)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(scopeLabels) as CommissionScopeType[])
                        .filter((key) => form.watch('basis') === 'satis' || ['all', 'sales_rep', 'clinic', 'customer'].includes(key))
                        .map((key) => (
                          <SelectItem key={key} value={key}>
                            {scopeLabels[key]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {scopeType === 'product' && (
              <ProductCombobox value={scopeValue ?? undefined} onChange={(p) => form.setValue('scope_value', p.id)} />
            )}
            {scopeType === 'category' && (
              <Select value={scopeValue ?? ''} onValueChange={(v) => form.setValue('scope_value', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scopeType === 'brand' && (
              <Select value={scopeValue ?? ''} onValueChange={(v) => form.setValue('scope_value', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Marka seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dermakor">Dermakor</SelectItem>
                  <SelectItem value="swiss">Swiss</SelectItem>
                </SelectContent>
              </Select>
            )}
            {scopeType === 'sales_rep' && (
              <Select value={scopeValue ?? ''} onValueChange={(v) => form.setValue('scope_value', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Temsilci seçin" />
                </SelectTrigger>
                <SelectContent>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scopeType === 'clinic' && (
              <ClinicCombobox value={scopeValue} onChange={(v) => form.setValue('scope_value', v)} />
            )}
            {scopeType === 'customer' && (
              <CustomerCombobox value={scopeValue ?? undefined} onChange={(v) => form.setValue('scope_value', v)} />
            )}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">Aktif kural</FormLabel>
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
