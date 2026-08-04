import * as React from 'react'
import { Fuel, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useCreateVehicleFuelLog } from './hooks'

export function FuelLogDialog({ vehicleId, vehicleName }: { vehicleId: string; vehicleName: string }) {
  const [open, setOpen] = React.useState(false)
  const [fillDate, setFillDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = React.useState<number | undefined>(undefined)
  const [note, setNote] = React.useState('')
  const createMutation = useCreateVehicleFuelLog()

  React.useEffect(() => {
    if (open) {
      setFillDate(format(new Date(), 'yyyy-MM-dd'))
      setAmount(undefined)
      setNote('')
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return
    await createMutation.mutateAsync({ vehicle_id: vehicleId, fill_date: fillDate, amount, note: note.trim() || null })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Yakıt yükleme ekle">
          <Fuel className="size-3.5" /> Yakıt Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Yakıt Yükleme — {vehicleName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fuel-date">Tarih</Label>
            <Input id="fuel-date" type="date" value={fillDate} onChange={(e) => setFillDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fuel-amount">Tutar</Label>
            <CurrencyInput id="fuel-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fuel-note">Not</Label>
            <Textarea id="fuel-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !amount}>
              {createMutation.isPending && <Loader2 className="animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
