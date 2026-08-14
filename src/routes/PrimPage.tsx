import * as React from 'react'
import { Pencil, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExportMenu } from '@/components/ExportMenu'
import { CommissionRuleForm } from '@/features/commissions/CommissionRuleForm'
import { CommissionAdjustmentForm } from '@/features/commissions/CommissionAdjustmentForm'
import {
  useCommissionAdjustments,
  useCommissionRules,
  useDeleteCommissionAdjustment,
  useDeleteCommissionRule,
} from '@/features/commissions/hooks'
import { calculateCommissions, type RepCommissionResult } from '@/features/commissions/calculateCommissions'
import { useSalesInRange } from '@/features/sales/hooks'
import { usePayments } from '@/features/payments/hooks'
import { useProducts } from '@/features/stock/hooks'
import { useCustomers } from '@/features/customers/hooks'
import { useSalesReps } from '@/features/salesReps/hooks'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function today() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const scopeLabels: Record<string, string> = {
  all: 'Tümü',
  product: 'Ürün',
  category: 'Kategori',
  brand: 'Marka',
  sales_rep: 'Temsilci',
  clinic: 'Klinik',
  customer: 'Doktor',
}

export function PrimPage() {
  const [from, setFrom] = React.useState(firstDayOfMonth())
  const [to, setTo] = React.useState(today())
  const [expandedRepId, setExpandedRepId] = React.useState<string | null>(null)
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(null)

  const { data: rules = [] } = useCommissionRules()
  const deleteRuleMutation = useDeleteCommissionRule()
  const { data: adjustments = [] } = useCommissionAdjustments(from, to)
  const deleteAdjustmentMutation = useDeleteCommissionAdjustment()
  const { data: sales = [], isLoading: salesLoading } = useSalesInRange(from, to)
  // payments.paid_at timestamptz olduğu için gün-sonu saatine genişletilmiyorsa
  // seçilen "to" gününde öğleden sonra yapılan tahsilatlar prim hesabından
  // sessizce düşer (bkz. PaymentsPage.tsx/BudgetYearPage.tsx'deki aynı desen).
  const { data: payments = [], isLoading: paymentsLoading } = usePayments({
    from,
    to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
  })
  const { data: products = [] } = useProducts('')
  const { data: customers = [] } = useCustomers('')
  const { data: salesReps = [] } = useSalesReps()

  const results: RepCommissionResult[] = React.useMemo(
    () => calculateCommissions(rules, sales, payments, products, customers, salesReps, adjustments),
    [rules, sales, payments, products, customers, salesReps, adjustments],
  )

  const loading = salesLoading || paymentsLoading

  return (
    <div>
      <PageHeader
        title="Prim Hesaplama"
        description="Ürün/kategori/marka/temsilci/klinik/doktor bazlı dinamik prim kuralları + seçilen dönem için bordro"
      />

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Prim Kuralları</h2>
          <CommissionRuleForm />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kural</TableHead>
                  <TableHead>Baz</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Oran</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      Henüz prim kuralı yok
                    </TableCell>
                  </TableRow>
                )}
                {rules.map((rule) => (
                  <TableRow key={rule.id} onClick={() => setSelectedRuleId(rule.id)} selected={rule.id === selectedRuleId}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{rule.basis === 'satis' ? 'Satış' : 'Tahsilat'}</TableCell>
                    <TableCell className="text-muted-foreground">{scopeLabels[rule.scope_type]}</TableCell>
                    <TableCell>%{rule.rate_percent}</TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'secondary' : 'outline'}>
                        {rule.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CommissionRuleForm rule={rule} trigger={<Button variant="ghost" size="icon"><Pencil className="size-3.5" /></Button>} />
                        <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="prim-from">Başlangıç</Label>
            <Input id="prim-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prim-to">Bitiş</Label>
            <Input id="prim-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <CommissionAdjustmentForm periodStart={from} periodEnd={to} />
          <ExportMenu<RepCommissionResult>
            title="Prim Bordrosu"
            filename={`prim-bordrosu-${from}-${to}`}
            rows={results}
            columns={[
              { header: 'Temsilci', value: (r) => r.salesRepName },
              { header: 'Baz Prim', value: (r) => r.baseCommissionTotal },
              { header: 'Bonus', value: (r) => r.bonusTotal },
              { header: 'Ceza', value: (r) => r.cezaTotal },
              { header: 'Net Prim', value: (r) => r.netTotal },
            ]}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Temsilci</TableHead>
                <TableHead>Baz Prim</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Ceza</TableHead>
                <TableHead>Net Prim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              )}
              {!loading && results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Seçilen dönemde prim hesaplanacak kayıt bulunamadı
                  </TableCell>
                </TableRow>
              )}
              {results.map((r) => (
                <React.Fragment key={r.salesRepId}>
                  <TableRow className="cursor-pointer" onClick={() => setExpandedRepId(expandedRepId === r.salesRepId ? null : r.salesRepId)}>
                    <TableCell>
                      {expandedRepId === r.salesRepId ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.salesRepName}</TableCell>
                    <TableCell className="tabular-nums">{currency(r.baseCommissionTotal)}</TableCell>
                    <TableCell className="tabular-nums text-success">{r.bonusTotal > 0 ? currency(r.bonusTotal) : '—'}</TableCell>
                    <TableCell className="tabular-nums text-destructive">{r.cezaTotal > 0 ? currency(r.cezaTotal) : '—'}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{currency(r.netTotal)}</TableCell>
                  </TableRow>
                  {expandedRepId === r.salesRepId && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="grid gap-1.5 text-sm">
                          {r.breakdown.map((b) => (
                            <div key={b.ruleId} className="flex items-center justify-between">
                              <span className="text-muted-foreground">{b.ruleName}</span>
                              <span>
                                {currency(b.baseAmount)} × prim ={' '}
                                <span className="font-medium">{currency(b.commissionAmount)}</span>
                              </span>
                            </div>
                          ))}
                          {adjustments
                            .filter((a) => a.sales_rep_id === r.salesRepId)
                            .map((a) => (
                              <div key={a.id} className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  {a.adjustment_type === 'bonus' ? 'Bonus' : 'Ceza'}
                                  {a.note ? ` — ${a.note}` : ''}
                                </span>
                                <span className="flex items-center gap-2">
                                  {currency(a.amount)}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteAdjustmentMutation.mutate(a.id)
                                    }}
                                  >
                                    {deleteAdjustmentMutation.isPending ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-3 text-destructive" />
                                    )}
                                  </Button>
                                </span>
                              </div>
                            ))}
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
