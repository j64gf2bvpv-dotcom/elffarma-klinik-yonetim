import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale'
import { CalendarRange, ArrowRight, AlertTriangle, Presentation } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CongressForm } from '@/features/congresses/CongressForm'
import { useCongresses } from '@/features/congresses/hooks'

export function CongressesPage() {
  const { data: congresses = [], isLoading } = useCongresses()

  return (
    <div>
      <PageHeader
        title="Kongreler"
        description="Kongre ve workshopları, katılan doktorları ve maliyetleri yönetin"
        actions={<CongressForm />}
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
                  {congress.image_url ? (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted p-1">
                      <img src={congress.image_url} alt={congress.name} className="size-full object-contain" />
                    </span>
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      <Presentation className="size-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 truncate text-lg font-semibold">{congress.name}</h3>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {congress.start_date
                          ? format(new Date(congress.start_date), 'd MMMM yyyy', { locale: trLocale })
                          : 'Tarih belirtilmedi'}
                        {congress.end_date &&
                          ` – ${format(new Date(congress.end_date), 'd MMMM yyyy', { locale: trLocale })}`}
                      </span>
                    </span>
                  </div>
                </div>
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
    </div>
  )
}
