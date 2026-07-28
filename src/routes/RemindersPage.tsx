import * as React from 'react'
import { format, isToday, isPast } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BellRing, Trash2, AlertTriangle, ClipboardX, CalendarClock, Wallet, PackageOpen, Presentation } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ReminderForm } from '@/features/reminders/ReminderForm'
import { useReminders, useUpdateReminder, useDeleteReminder, useDeleteRemindersBulk } from '@/features/reminders/hooks'
import { useAlertsSummary } from '@/features/alerts/useAlertsSummary'
import { getPaymentDueStatus } from '@/lib/paymentDue'
import { cn } from '@/lib/utils'
import type { Reminder } from '@/types/database'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const updateMutation = useUpdateReminder()
  const deleteMutation = useDeleteReminder()
  const overdue = !reminder.is_done && isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date))

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 transition-all',
        overdue ? 'border-destructive/20 bg-destructive/5' : 'hover:shadow-sm',
        reminder.is_done && 'opacity-60',
      )}
    >
      <Checkbox
        checked={reminder.is_done}
        onCheckedChange={(checked) =>
          updateMutation.mutate({ id: reminder.id, input: { is_done: checked === true } })
        }
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', reminder.is_done && 'line-through')}>{reminder.title}</p>
        {reminder.note && <p className="text-muted-foreground mt-0.5 text-sm">{reminder.note}</p>}
      </div>
      <Badge
        variant="outline"
        className={cn(overdue && 'animate-alert-glow-red border-transparent bg-destructive/15 text-destructive')}
      >
        {format(new Date(reminder.due_date), 'd MMM yyyy', { locale: trLocale })}
      </Badge>
      <ReminderForm reminder={reminder} />
      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(reminder.id)}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  )
}

function AlertRow({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <Link
      to={to}
      className="border-destructive/20 bg-destructive/5 flex items-center gap-3 rounded-xl border p-3 text-sm transition-all hover:-translate-y-0.5 hover:bg-destructive/10 hover:shadow-md"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </div>
      <Badge variant="outline" className="animate-alert-glow-red border-transparent bg-destructive/15 text-destructive shrink-0">
        Uyarı
      </Badge>
    </Link>
  )
}

export function RemindersPage() {
  const { data: reminders = [] } = useReminders()
  const alerts = useAlertsSummary()
  const deleteBulkMutation = useDeleteRemindersBulk()

  const clearedOnViewRef = React.useRef(false)
  React.useEffect(() => {
    if (clearedOnViewRef.current || reminders.length === 0) return
    clearedOnViewRef.current = true
    deleteBulkMutation.mutate(reminders.map((r) => r.id))
  }, [reminders, deleteBulkMutation])

  function handleDeleteAll() {
    if (reminders.length === 0) return
    deleteBulkMutation.mutate(
      reminders.map((r) => r.id),
      { onSuccess: () => toast.success('Tüm hatırlatmalar silindi') },
    )
  }

  const overdue = reminders.filter(
    (r) => !r.is_done && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)),
  )
  const today = reminders.filter((r) => !r.is_done && isToday(new Date(r.due_date)))
  const upcoming = reminders.filter(
    (r) => !r.is_done && !isToday(new Date(r.due_date)) && !isPast(new Date(r.due_date)),
  )
  const done = reminders.filter((r) => r.is_done)

  const sections: { label: string; items: Reminder[] }[] = [
    { label: 'Gecikmiş', items: overdue },
    { label: 'Bugün', items: today },
    { label: 'Yaklaşan', items: upcoming },
    { label: 'Tamamlanan', items: done },
  ]

  const systemAlertCount =
    alerts.criticalStock.length +
    alerts.expiringProducts.length +
    alerts.paymentDue.length +
    alerts.doctorsWithBalance.length +
    alerts.pendingProducts.length

  return (
    <div>
      <PageHeader
        title="Hatırlatmalar"
        description="Sistem uyarıları ve kişisel hatırlatmaların tek merkezi"
        actions={
          <>
            <Button variant="outline" onClick={handleDeleteAll} disabled={reminders.length === 0}>
              <Trash2 className="text-destructive" />
              Tümünü Sil
            </Button>
            <ReminderForm />
          </>
        }
      />
      <div className="grid gap-6">
        {systemAlertCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-destructive" /> Sistem Uyarıları
                <Badge variant="secondary">{systemAlertCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {alerts.criticalStock.map((p) => (
                <AlertRow
                  key={`stock-${p.id}`}
                  to="/stok"
                  icon={AlertTriangle}
                  title={p.name}
                  subtitle={`Kritik stok seviyesinde (${p.current_quantity} ${p.unit})`}
                />
              ))}
              {alerts.expiringProducts.map((p) => (
                <AlertRow
                  key={`expiry-${p.id}`}
                  to="/stok"
                  icon={ClipboardX}
                  title={p.name}
                  subtitle={`Son kullanım tarihi ${p.expiry_date && new Date(p.expiry_date) < new Date() ? 'doldu' : 'yaklaşıyor'}: ${p.expiry_date}`}
                />
              ))}
              {alerts.paymentDue.map((d) => (
                <AlertRow
                  key={`due-${d.id}`}
                  to={`/musteriler/${d.id}`}
                  icon={CalendarClock}
                  title={d.full_name}
                  subtitle={`Ödeme vadesi ${getPaymentDueStatus(d.next_payment_due) === 'overdue' ? 'geçti' : 'yaklaşıyor'}`}
                />
              ))}
              {alerts.doctorsWithBalance.map((d) => (
                <AlertRow
                  key={`balance-${d.id}`}
                  to={`/musteriler/${d.id}`}
                  icon={Wallet}
                  title={d.full_name}
                  subtitle={`Eksik bakiye: ${currency(d.balance)}`}
                />
              ))}
              {alerts.pendingProducts.map((p) => (
                <AlertRow
                  key={`pending-${p.id}`}
                  to={`/musteriler/${p.customer_id}`}
                  icon={PackageOpen}
                  title={p.customers?.full_name ?? 'Doktor'}
                  subtitle={`Eksik ürün: ${p.product_name} × ${p.quantity}`}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {alerts.upcomingCongresses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Presentation className="size-4 text-primary" /> Yaklaşan Kongreler
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {alerts.upcomingCongresses.map((c) => (
                <Link
                  key={c.id}
                  to={`/kongreler/${c.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.start_date && (
                    <Badge variant="outline">{format(new Date(c.start_date), 'd MMM yyyy', { locale: trLocale })}</Badge>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {sections.map(
          (section) =>
            section.items.length > 0 && (
              <Card key={section.label}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BellRing className="size-4 text-primary" /> {section.label}
                    <Badge variant="secondary">{section.items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {section.items.map((reminder) => (
                    <ReminderRow key={reminder.id} reminder={reminder} />
                  ))}
                </CardContent>
              </Card>
            ),
        )}
        {reminders.length === 0 && systemAlertCount === 0 && alerts.upcomingCongresses.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <BellRing className="text-muted-foreground size-10" />
              <p className="text-muted-foreground text-sm">Henüz bildirim veya hatırlatma yok</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
