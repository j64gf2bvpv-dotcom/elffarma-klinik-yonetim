import { useNavigate, useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale'
import { ArrowLeft, Loader2, Trash2, Package, UserRound, MapPin, Presentation } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { WorkshopForm } from '@/features/workshops/WorkshopForm'
import { WorkshopParticipantDialog } from '@/features/workshops/WorkshopParticipantDialog'
import { WorkshopProductDialog } from '@/features/workshops/WorkshopProductDialog'
import { PostToExpenseButton } from '@/features/expenses/PostToExpenseButton'
import {
  useWorkshop,
  useDeleteWorkshop,
  useDeleteWorkshopParticipant,
  useDeleteWorkshopProduct,
  useWorkshopParticipants,
} from '@/features/workshops/hooks'
import { useCongress } from '@/features/congresses/hooks'

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: workshop, isLoading } = useWorkshop(id)
  const { data: participants = [] } = useWorkshopParticipants(id)
  const { data: congress } = useCongress(workshop?.congress_id ?? undefined)
  const deleteWorkshopMutation = useDeleteWorkshop()
  const deleteParticipantMutation = useDeleteWorkshopParticipant()
  const deleteProductMutation = useDeleteWorkshopProduct()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workshop) return <p>Workshop bulunamadı.</p>

  const totalProducts = participants.reduce(
    (sum, p) => sum + p.workshop_products.reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0),
    0,
  )

  const salesByRep = new Map<
    string,
    { repName: string; total: number; rows: { doctorName: string; productName: string; quantity: number; unitPrice: number }[] }
  >()
  for (const participant of participants) {
    for (const product of participant.workshop_products) {
      const key = product.sales_rep_id ?? 'none'
      const repName = product.sales_reps?.name ?? 'Belirtilmedi'
      if (!salesByRep.has(key)) salesByRep.set(key, { repName, total: 0, rows: [] })
      const entry = salesByRep.get(key)!
      entry.rows.push({
        doctorName: participant.customers?.full_name ?? 'Doktor',
        productName: product.products?.name ?? 'Ürün',
        quantity: Number(product.quantity),
        unitPrice: Number(product.unit_price),
      })
      entry.total += Number(product.quantity) * Number(product.unit_price)
    }
  }
  const repSales = Array.from(salesByRep.values()).sort((a, b) => b.total - a.total)

  async function handleDelete() {
    if (!confirm(`${workshop!.name} silinsin mi? Tüm doktor ve ürün kayıtları da silinecek.`)) return
    await deleteWorkshopMutation.mutateAsync(workshop!.id)
    navigate('/workshoplar')
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/workshoplar')}>
        <ArrowLeft /> Workshoplara Dön
      </Button>

      <PageHeader
        title={workshop.name}
        description={workshop.workshop_date ? format(new Date(workshop.workshop_date), 'd MMMM yyyy', { locale: trLocale }) : 'Tarih belirtilmedi'}
        actions={
          <div className="flex items-center gap-2">
            {workshop.location && (
              <Badge variant="outline">
                <MapPin className="size-3" /> {workshop.location}
              </Badge>
            )}
            {congress && (
              <Badge variant="outline" asChild>
                <Link to={`/kongreler/${congress.id}`}>
                  <Presentation className="size-3" /> {congress.name}
                </Link>
              </Badge>
            )}
            <WorkshopForm workshop={workshop} />
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 /> Sil
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Katılımcı Doktor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{participants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Toplam Ürün Tutarı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(totalProducts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Workshop Maliyeti</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2">
            <p className="text-2xl font-semibold">{currency(Number(workshop.cost ?? 0))}</p>
            {workshop.cost != null && workshop.cost > 0 && (
              <PostToExpenseButton
                category="workshop_gideri"
                amount={Number(workshop.cost)}
                description={`${workshop.name} workshop gideri`}
                workshopId={workshop.id}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Katılımcı Doktorlar</h2>
        <WorkshopParticipantDialog workshopId={workshop.id} />
      </div>

      {participants.length === 0 && (
        <p className="text-muted-foreground">
          Henüz doktor eklenmedi. Ürün ekleyebilmek için önce yukarıdan <strong>"Doktor Ekle"</strong> ile bir
          katılımcı ekleyin.
        </p>
      )}

      <div className="grid gap-4">
        {participants.map((participant) => {
          const productsTotal = participant.workshop_products.reduce(
            (s, x) => s + Number(x.quantity) * Number(x.unit_price),
            0,
          )
          return (
            <Card key={participant.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{participant.customers?.full_name ?? 'Doktor'}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    deleteParticipantMutation.mutate({ id: participant.id, workshopId: workshop.id })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                {participant.notes && <p className="mb-3 text-sm text-muted-foreground">{participant.notes}</p>}

                <Separator className="mb-3" />

                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Package className="size-4" /> Aldığı Ürünler
                  </p>
                  <WorkshopProductDialog
                    participantId={participant.id}
                    workshopId={workshop.id}
                    workshopName={workshop.name}
                    doctorName={participant.customers?.full_name}
                    customerId={participant.customer_id}
                  />
                </div>

                {participant.workshop_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ürün eklenmedi.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {participant.workshop_products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          {product.products?.name ?? 'Ürün'}{' '}
                          <span className="text-muted-foreground">
                            × {product.quantity} @ {currency(Number(product.unit_price))}
                          </span>
                          {product.sales_reps?.name && (
                            <Badge variant="secondary" className="ml-2">
                              <UserRound className="size-3" /> {product.sales_reps.name}
                            </Badge>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {currency(Number(product.quantity) * Number(product.unit_price))}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteProductMutation.mutate({ id: product.id, workshopId: workshop.id })
                            }
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <p className="mt-1 text-right text-sm font-medium">Ürün Toplamı: {currency(productsTotal)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {repSales.length > 0 && (
        <>
          <Separator className="my-6" />
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Satış Temsilcisi Paneli</CardTitle>
              <p className="text-sm text-muted-foreground">Hangi temsilci, hangi doktora, hangi ürünü sattı.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {repSales.map((rep) => (
                  <div key={rep.repName} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <UserRound className="text-primary size-4" /> {rep.repName}
                      </p>
                      <Badge variant="success">{currency(rep.total)}</Badge>
                    </div>
                    <div className="grid gap-1.5">
                      {rep.rows.map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="font-medium">{row.doctorName}</span>{' '}
                            <span className="text-muted-foreground">
                              — {row.productName} × {row.quantity} @ {currency(row.unitPrice)}
                            </span>
                          </span>
                          <span className="font-medium">{currency(row.quantity * row.unitPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
