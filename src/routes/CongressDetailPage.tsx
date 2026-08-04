import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale'
import {
  ArrowLeft,
  Loader2,
  Plane,
  BadgeCheck,
  BedDouble,
  Trash2,
  Package,
  AlertTriangle,
  UserRound,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { CongressForm } from '@/features/congresses/CongressForm'
import { ParticipantDialog } from '@/features/congresses/ParticipantDialog'
import { ParticipantProductDialog } from '@/features/congresses/ParticipantProductDialog'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { ChecklistPanel } from '@/features/congresses/ChecklistPanel'
import { CongressStockItemsPanel } from '@/features/congresses/CongressStockItemsPanel'
import { ConsumablesPanel } from '@/features/congresses/ConsumablesPanel'
import { useCongress, useDeleteCongress, useDeleteParticipantProduct, useParticipants } from '@/features/congresses/hooks'
import type { AttendanceStatus } from '@/types/database'

const attendanceLabels: Record<AttendanceStatus, string> = {
  registered: 'Kayıtlı',
  attended: 'Katıldı',
  no_show: 'Gelmedi',
}

const attendanceVariant: Record<AttendanceStatus, 'outline' | 'success' | 'destructive'> = {
  registered: 'outline',
  attended: 'success',
  no_show: 'destructive',
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function CongressDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: congress, isLoading } = useCongress(id)
  const { data: participants = [] } = useParticipants(id)
  const deleteCongressMutation = useDeleteCongress()
  const deleteProductMutation = useDeleteParticipantProduct()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!congress) return <p>Kongre bulunamadı.</p>

  const totalProducts = participants.reduce(
    (sum, p) =>
      sum + p.congress_participant_products.reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0),
    0,
  )
  const totalAttendanceCost = participants.reduce(
    (sum, p) => sum + Number(p.flight_cost) + Number(p.registration_cost) + Number(p.accommodation_cost),
    0,
  )
  const netProfit = totalProducts - totalAttendanceCost
  const profitMargin = totalProducts > 0 ? (netProfit / totalProducts) * 100 : null

  const salesByRep = new Map<
    string,
    { repName: string; total: number; rows: { doctorName: string; productName: string; quantity: number; unitPrice: number }[] }
  >()
  for (const participant of participants) {
    for (const product of participant.congress_participant_products) {
      const key = product.sales_rep_id ?? 'none'
      const repName = product.sales_reps?.name ?? 'Belirtilmedi'
      if (!salesByRep.has(key)) salesByRep.set(key, { repName, total: 0, rows: [] })
      const entry = salesByRep.get(key)!
      entry.rows.push({
        doctorName: participant.doctor_name,
        productName: product.product_name,
        quantity: Number(product.quantity),
        unitPrice: Number(product.unit_price),
      })
      entry.total += Number(product.quantity) * Number(product.unit_price)
    }
  }
  const repSales = Array.from(salesByRep.values()).sort((a, b) => b.total - a.total)

  async function handleDeleteCongress() {
    if (!confirm(`${congress!.name} silinsin mi? Tüm doktor ve ürün kayıtları da silinecek.`)) return
    await deleteCongressMutation.mutateAsync(congress!.id)
    navigate('/kongreler')
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/kongreler')}>
        <ArrowLeft /> Kongrelere Dön
      </Button>

      <PageHeader
        title={congress.name}
        description={
          congress.start_date
            ? `${format(new Date(congress.start_date), 'd MMMM yyyy', { locale: trLocale })}${
                congress.end_date
                  ? ' – ' + format(new Date(congress.end_date), 'd MMMM yyyy', { locale: trLocale })
                  : ''
              }`
            : 'Tarih belirtilmedi'
        }
        actions={
          <div className="flex items-center gap-2">
            {congress.will_attend && (
              <Badge variant="warning">
                <AlertTriangle className="size-3" /> Katılım Planlandı
              </Badge>
            )}
            {congress.single_person_price != null && (
              <Badge variant="outline">Tek Kişi: {currency(Number(congress.single_person_price))}</Badge>
            )}
            {congress.two_person_price != null && (
              <Badge variant="outline">2 Kişi: {currency(Number(congress.two_person_price))}</Badge>
            )}
            <CongressForm congress={congress} />
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteCongress}
            >
              <Trash2 /> Sil
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Katılımcı Doktor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{participants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Toplam Katılım Maliyeti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(totalAttendanceCost)}</p>
            <p className="text-xs text-muted-foreground">Uçak + Kayıt + Konaklama</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Toplam Ürün Geliri</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currency(totalProducts)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Kâr / Zarar</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'flex items-center gap-1.5 text-2xl font-semibold',
                netProfit >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {netProfit >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
              {currency(netProfit)}
            </p>
            {profitMargin != null && (
              <p className="text-xs text-muted-foreground">Marj: %{profitMargin.toFixed(1)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(congress.city ||
        congress.venue ||
        congress.hotel ||
        congress.capacity != null ||
        congress.sponsorship_info ||
        congress.speakers ||
        congress.trainers ||
        congress.meal_plan ||
        congress.transfer_info ||
        congress.stand_info ||
        congress.budget != null ||
        congress.campaign_info ||
        congress.video_urls.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Etkinlik Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {congress.city && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">ŞEHİR</p>
                <p>{congress.city}</p>
              </div>
            )}
            {congress.venue && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">SALON</p>
                <p>{congress.venue}</p>
              </div>
            )}
            {congress.hotel && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">OTEL</p>
                <p>{congress.hotel}</p>
              </div>
            )}
            {congress.capacity != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">KONTENJAN</p>
                <p>{congress.capacity}</p>
              </div>
            )}
            {congress.budget != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">BÜTÇE</p>
                <p>{currency(Number(congress.budget))}</p>
              </div>
            )}
            {congress.speakers && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">KONUŞMACILAR</p>
                <p>{congress.speakers}</p>
              </div>
            )}
            {congress.trainers && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">EĞİTMENLER</p>
                <p>{congress.trainers}</p>
              </div>
            )}
            {congress.sponsorship_info && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">SPONSORLUK</p>
                <p>{congress.sponsorship_info}</p>
              </div>
            )}
            {congress.meal_plan && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">YEMEK PLANI</p>
                <p>{congress.meal_plan}</p>
              </div>
            )}
            {congress.transfer_info && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">TRANSFER</p>
                <p>{congress.transfer_info}</p>
              </div>
            )}
            {congress.stand_info && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">STAND</p>
                <p>{congress.stand_info}</p>
              </div>
            )}
            {congress.campaign_info && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">KAMPANYA</p>
                <p>{congress.campaign_info}</p>
              </div>
            )}
            {congress.video_urls.length > 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">VİDEOLAR</p>
                <div className="grid gap-1">
                  {congress.video_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Katılımcı Doktorlar</h2>
        <ParticipantDialog congressId={congress.id} />
      </div>

      {participants.length === 0 && (
        <p className="text-muted-foreground">
          Henüz doktor eklenmedi. Ürün ekleyebilmek için önce yukarıdan <strong>"Doktor Ekle"</strong> ile bir
          katılımcı ekleyin — "Aldığı Ürünler" ve "Ürün Ekle" seçeneği her doktorun kartında görünür.
        </p>
      )}

      <div className="grid gap-4">
        {participants.map((participant) => {
          const productsTotal = participant.congress_participant_products.reduce(
            (s, x) => s + Number(x.quantity) * Number(x.unit_price),
            0,
          )
          const packagePrice =
            Number(participant.flight_cost) +
            Number(participant.registration_cost) +
            Number(participant.accommodation_cost) +
            productsTotal
          return (
            <Card key={participant.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{participant.doctor_name}</CardTitle>
                <ParticipantDialog congressId={congress.id} participant={participant} />
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <Plane className="size-3" /> Uçak: {currency(Number(participant.flight_cost))}
                  </Badge>
                  <Badge variant="outline">
                    <BadgeCheck className="size-3" /> Kayıt: {currency(Number(participant.registration_cost))}
                  </Badge>
                  <Badge variant="outline">
                    <BedDouble className="size-3" /> Konaklama: {currency(Number(participant.accommodation_cost))}
                  </Badge>
                  {productsTotal > 0 && (
                    <Badge variant="outline">
                      <Package className="size-3" /> Ürünler: {currency(productsTotal)}
                    </Badge>
                  )}
                  <Badge variant="success">Katılım Paket Fiyatı: {currency(packagePrice)}</Badge>
                  <Badge variant={attendanceVariant[participant.attendance_status]}>
                    {attendanceLabels[participant.attendance_status]}
                  </Badge>
                  {participant.certificate_issued && <Badge variant="secondary">Belge Verildi</Badge>}
                </div>
                {participant.notes && <p className="mb-3 text-sm text-muted-foreground">{participant.notes}</p>}

                <Separator className="mb-3" />

                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Package className="size-4" /> Aldığı Ürünler
                  </p>
                  <ParticipantProductDialog
                    participantId={participant.id}
                    congressId={congress.id}
                    congressName={congress.name}
                    doctorName={participant.doctor_name}
                  />
                </div>

                {participant.congress_participant_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ürün eklenmedi.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {participant.congress_participant_products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          {product.product_name}{' '}
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
                              deleteProductMutation.mutate({ id: product.id, congressId: congress.id })
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

      <Separator className="my-6" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Satış Temsilcisi Paneli</CardTitle>
          <p className="text-sm text-muted-foreground">Hangi temsilci, hangi doktora, hangi ürünü sattı.</p>
        </CardHeader>
        <CardContent>
          {repSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz ürün satışı kaydedilmedi.</p>
          ) : (
            <div className="grid gap-4">
              {repSales.map((rep) => (
                <div key={rep.repName} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <UserRound className="size-4 text-primary" /> {rep.repName}
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
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <CongressStockItemsPanel congressId={congress.id} congressName={congress.name} />
      </div>

      <div className="mb-6">
        <ConsumablesPanel congressId={congress.id} />
      </div>

      <ChecklistPanel congressId={congress.id} />

      <AttachmentsPanel ownerType="congress" ownerId={congress.id} />
    </div>
  )
}
