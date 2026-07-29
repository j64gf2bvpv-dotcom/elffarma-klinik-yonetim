import * as React from 'react'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { ChevronDown, ChevronRight, Trash2, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SampleRequestForm } from '@/features/samples/SampleRequestForm'
import { useDeleteSampleRequest, useSampleRequests, useUpdateSampleRequestStatus } from '@/features/samples/hooks'
import { useSales } from '@/features/sales/hooks'
import { calculateSampleConversion } from '@/features/samples/calculateSampleConversion'
import type { SampleRequestStatus } from '@/types/database'

const statusLabels: Record<SampleRequestStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
}

const statusVariant: Record<SampleRequestStatus, 'outline' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  pending: 'outline',
  approved: 'secondary',
  rejected: 'destructive',
  shipped: 'warning',
  delivered: 'success',
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function SamplesPage() {
  const { data: requests = [], isLoading } = useSampleRequests()
  const { data: sales = [] } = useSales()
  const updateStatusMutation = useUpdateSampleRequestStatus()
  const deleteMutation = useDeleteSampleRequest()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [trackingDrafts, setTrackingDrafts] = React.useState<Record<string, string>>({})
  const [deliveredToDrafts, setDeliveredToDrafts] = React.useState<Record<string, string>>({})

  const conversion = React.useMemo(() => calculateSampleConversion(requests, sales), [requests, sales])

  function handleStatusChange(id: string, status: SampleRequestStatus) {
    updateStatusMutation.mutate({
      id,
      input: {
        status,
        tracking_number: trackingDrafts[id],
        delivered_to: deliveredToDrafts[id],
        shipped_at: status === 'shipped' ? new Date().toISOString().slice(0, 10) : undefined,
        delivered_at: status === 'delivered' ? new Date().toISOString().slice(0, 10) : undefined,
      },
    })
  }

  return (
    <div>
      <PageHeader
        title="Numune Takibi"
        description="Doktorlara verilen numunelerin onay/kargo/teslim süreci ve satışa dönüşüm oranı"
        actions={<SampleRequestForm />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">TOPLAM NUMUNE ÜRÜNÜ</p>
            <p className="text-lg font-semibold tabular-nums">{conversion.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">SATIŞA DÖNEN</p>
            <p className="text-lg font-semibold tabular-nums text-success">{conversion.convertedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">DÖNÜŞÜM ORANI</p>
            <p className="text-lg font-semibold tabular-nums">%{conversion.percent.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Doktor</TableHead>
                <TableHead>Temsilci</TableHead>
                <TableHead>Talep Tarihi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Numune talebi bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {requests.map((r) => (
                <React.Fragment key={r.id}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <TableCell>
                      {expandedId === r.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.customers?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sales_reps?.name ?? '—'}</TableCell>
                    <TableCell>{format(new Date(r.request_date), 'd MMM yyyy', { locale: trLocale })}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[r.status]}>{statusLabels[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v as SampleRequestStatus)}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(statusLabels) as SampleRequestStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {statusLabels[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                          {deleteMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="grid gap-3 text-sm">
                          <div className="grid gap-1.5">
                            {r.sample_items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between">
                                <span>
                                  {item.products?.name ?? item.product_id} × {item.quantity}
                                  {item.lot_no ? ` · Lot: ${item.lot_no}` : ''}
                                  {item.expiry_date
                                    ? ` · SKT: ${format(new Date(item.expiry_date), 'd MMM yyyy', { locale: trLocale })}`
                                    : ''}
                                </span>
                                <span className="text-muted-foreground">
                                  {currency(Number(item.unit_price) * item.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {r.note && <p className="text-muted-foreground">{r.note}</p>}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-xs">Kargo Takip No</Label>
                              <Input
                                defaultValue={r.tracking_number ?? ''}
                                onChange={(e) => setTrackingDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                                onBlur={() =>
                                  updateStatusMutation.mutate({
                                    id: r.id,
                                    input: { status: r.status, tracking_number: trackingDrafts[r.id] ?? r.tracking_number },
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-xs">Teslim Alan</Label>
                              <Input
                                defaultValue={r.delivered_to ?? ''}
                                onChange={(e) => setDeliveredToDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                                onBlur={() =>
                                  updateStatusMutation.mutate({
                                    id: r.id,
                                    input: { status: r.status, delivered_to: deliveredToDrafts[r.id] ?? r.delivered_to },
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
