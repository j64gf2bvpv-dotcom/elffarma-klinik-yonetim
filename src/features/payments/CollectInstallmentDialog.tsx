import * as React from 'react'
import { Loader2, HandCoins } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { createPayment } from './api'
import { useMarkInstallmentPaid } from './hooks'
import { tr } from '@/i18n/tr'
import type { InstallmentWithPlan } from './api'
import type { PaymentMethod } from '@/types/database'

export function CollectInstallmentDialog({ installment }: { installment: InstallmentWithPlan }) {
  const [open, setOpen] = React.useState(false)
  const [method, setMethod] = React.useState<PaymentMethod>('nakit')
  const [submitting, setSubmitting] = React.useState(false)
  const markPaidMutation = useMarkInstallmentPaid()

  const plan = installment.payment_installment_plans

  async function handleCollect() {
    if (!plan) return
    setSubmitting(true)
    try {
      const payment = await createPayment({
        customer_id: plan.customer_id,
        amount: Number(installment.amount),
        payment_method: method,
        description: `Taksit ${installment.installment_no} tahsilatı`,
        paid_at: new Date().toISOString(),
      })
      await markPaidMutation.mutateAsync({ installmentId: installment.id, paymentId: payment.id })
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HandCoins className="size-3.5" /> Tahsil Et
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Taksit {installment.installment_no} Tahsilatı</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Ödeme Yöntemi</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tr.paymentMethod).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={handleCollect} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Tahsil Et
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
