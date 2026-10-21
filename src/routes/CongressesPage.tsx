import * as React from 'react'
import { formatDateRange } from '@/lib/dateRange'
import { Link } from 'react-router-dom'
import { CalendarRange, ArrowRight, AlertTriangle, Trash2, Globe, Loader2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExportMenu } from '@/components/ExportMenu'
import { CongressForm } from '@/features/congresses/CongressForm'
import { useCongresses, useDeleteCongress } from '@/features/congresses/hooks'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useAIService } from '@/features/ai/useAIService'
import { readCongressWebsite, summarizeCongress, uploadSquareCongressImage } from '@/features/congresses/websiteAssets'
import { supabase } from '@/lib/supabaseClient'
import { CongressImageDrop } from '@/features/congresses/CongressImageDrop'
import type { Congress } from '@/types/database'

export function CongressesPage() {
  const { data: congresses = [], isLoading } = useCongresses()
  const deleteCongress = useDeleteCongress()
  const { confirm, dialog } = useConfirmDialog()
  const aiService = useAIService()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = React.useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, congress: Congress) {
    e.preventDefault()
    e.stopPropagation()
    const ok = await confirm(
      `"${congress.name}" silinsin mi? Kongreye bağlı katılımcılar, ürün dağıtımları ve kontrol listesi de silinir. Bu işlem geri alınamaz.`,
    )
    if (ok) deleteCongress.mutate(congress.id)
  }

  /**
   * Web sitesi olan kongrelerde boş olan görseli (kareye uyarlanmış) ve kısa
   * açıklamayı siteden doldurur (2026-10-21). Dolu alanlara dokunmaz.
   */
  async function refreshFromWebsites() {
    const targets = congresses.filter((c) => c.website_url && (!c.image_url || !c.summary))
    if (targets.length === 0) {
      toast.info('Doldurulacak bilgi yok', { description: 'Web sitesi olan tüm kongrelerin görseli ve açıklaması zaten var.' })
      return
    }
    let updated = 0
    for (const c of targets) {
      setRefreshing(c.name)
      try {
        const site = await readCongressWebsite(c.website_url!)
        if (!site) continue
        const patch: { image_url?: string; summary?: string } = {}
        if (!c.image_url && site.info.image_url) {
          const url = await uploadSquareCongressImage(site.info.image_url).catch(() => null)
          if (url) patch.image_url = url
        }
        if (!c.summary) {
          const summary = await summarizeCongress(aiService, c.name, site.info, site.text)
          if (summary) patch.summary = summary
        }
        if (Object.keys(patch).length > 0) {
          const { error } = await supabase.from('congresses').update(patch).eq('id', c.id)
          if (!error) updated++
        }
      } catch {
        /* bir site hata verirse diğerlerine devam */
      }
    }
    setRefreshing(null)
    await queryClient.invalidateQueries({ queryKey: ['congresses'] })
    toast.success(`${updated} kongrenin görseli / açıklaması web sitesinden dolduruldu`)
  }

  return (
    <div>
      <PageHeader
        title="Kongreler"
        description="Kongre ve workshopları, katılan doktorları ve maliyetleri yönetin"
        actions={
          <div className="flex gap-2">
            <ExportMenu<Congress>
              title="Kongre Listesi"
              filename="kongreler"
              rows={congresses}
              columns={[
                { header: 'Kongre', value: (c) => c.name },
                { header: 'Başlangıç', value: (c) => c.start_date ?? '' },
                { header: 'Bitiş', value: (c) => c.end_date ?? '' },
                { header: 'Katılım Planlandı', value: (c) => (c.will_attend ? 'Evet' : 'Hayır') },
                { header: 'Tek Kişi Fiyatı', value: (c) => (c.single_person_price != null ? Number(c.single_person_price) : '') },
                { header: '2 Kişi Fiyatı', value: (c) => (c.two_person_price != null ? Number(c.two_person_price) : '') },
              ]}
            />
            <Button variant="outline" onClick={() => void refreshFromWebsites()} disabled={!!refreshing} title="Web sitesi olan kongrelerde boş görsel ve kısa açıklamayı siteden doldur">
              {refreshing ? <Loader2 className="animate-spin" /> : <Globe />}
              {refreshing ? `Okunuyor: ${refreshing.slice(0, 24)}…` : 'Sitelerden görsel ve açıklama getir'}
            </Button>
            <CongressForm />
          </div>
        }
      />

      {isLoading && <p className="text-muted-foreground">Yükleniyor...</p>}

      {!isLoading && congresses.length === 0 && (
        <p className="text-muted-foreground">Henüz kongre eklenmedi.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {congresses.map((congress) => (
          <Link key={congress.id} to={`/kongreler/${congress.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start gap-3">
                  <CongressImageDrop congress={congress} />
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 line-clamp-2 text-lg leading-snug font-semibold" title={congress.name}>
                      {congress.name}
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {congress.start_date ? formatDateRange(congress.start_date, congress.end_date) : 'Tarih belirtilmedi'}
                      </span>
                    </span>
                    {congress.city && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{[congress.city, congress.venue].filter(Boolean).join(' · ')}</span>
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-1 -mr-2 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Kongreyi sil"
                    onClick={(e) => void handleDelete(e, congress)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {congress.summary && <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">{congress.summary}</p>}
                {congress.will_attend && (
                  <Badge variant="warning" className="mb-3">
                    <AlertTriangle className="size-3" /> Katılım Planlandı
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="px-0 text-primary hover:bg-transparent hover:text-primary">
                  Detaylar <ArrowRight className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {dialog}
    </div>
  )
}
