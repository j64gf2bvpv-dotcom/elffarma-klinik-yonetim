import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale'
import { CalendarRange, ArrowRight, MapPin, Files } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WorkshopForm } from '@/features/workshops/WorkshopForm'
import { useWorkshops } from '@/features/workshops/hooks'

export function WorkshopsPage() {
  const { data: workshops = [], isLoading } = useWorkshops()

  return (
    <div>
      <PageHeader
        title="Workshoplar"
        description="Workshopları, katılan doktorları, dağıtılan ürünleri ve maliyetleri yönetin"
        actions={<WorkshopForm />}
      />

      {isLoading && <p className="text-muted-foreground">Yükleniyor...</p>}

      {!isLoading && workshops.length === 0 && <p className="text-muted-foreground">Henüz workshop eklenmedi.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workshops.map((workshop) => (
          <Link key={workshop.id} to={`/workshoplar/${workshop.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start gap-3">
                  <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg border">
                    <Files className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 truncate text-lg font-semibold">{workshop.name}</h3>
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <CalendarRange className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {workshop.workshop_date
                          ? format(new Date(workshop.workshop_date), 'd MMMM yyyy', { locale: trLocale })
                          : 'Tarih belirtilmedi'}
                      </span>
                    </span>
                    {workshop.location && (
                      <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{workshop.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                {workshop.congresses?.name && (
                  <Badge variant="outline" className="mb-3">
                    {workshop.congresses.name}
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
