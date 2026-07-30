import * as React from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { tr as trLocale } from 'date-fns/locale/tr'
import { Trash2, Phone, MessageCircle, Mail, Users, Video, StickyNote } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CrmActivityForm } from '@/features/crm/CrmActivityForm'
import { CrmOpportunityForm } from '@/features/crm/CrmOpportunityForm'
import { useCrmActivities, useCrmOpportunities, useDeleteCrmActivity, useDeleteCrmOpportunity } from '@/features/crm/hooks'
import { tr } from '@/i18n/tr'
import type { CrmOpportunityStage } from '@/types/database'

const stages: CrmOpportunityStage[] = ['yeni', 'teklif', 'muzakere', 'kazanildi', 'kaybedildi']

const activityIcons: Record<string, React.ElementType> = {
  arama: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  toplanti: Users,
  video_gorusme: Video,
  not: StickyNote,
}

function currency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
}

export function CrmPage() {
  const { data: opportunities = [] } = useCrmOpportunities()
  const { data: activities = [] } = useCrmActivities()
  const deleteOpportunityMutation = useDeleteCrmOpportunity()
  const deleteActivityMutation = useDeleteCrmActivity()

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Fırsatlar/satış hunisi ve doktor aktivite geçmişi"
        actions={
          <div className="flex gap-2">
            <CrmActivityForm />
            <CrmOpportunityForm />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        {stages.map((stage) => {
          const stageOpportunities = opportunities.filter((o) => o.stage === stage)
          const stageTotal = stageOpportunities.reduce((sum, o) => sum + Number(o.amount ?? 0), 0)
          return (
            <Card key={stage}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  {tr.crmOpportunityStage[stage]}
                  <Badge variant="outline">{stageOpportunities.length}</Badge>
                </CardTitle>
                {stageTotal > 0 && <p className="text-muted-foreground text-xs">{currency(stageTotal)}</p>}
              </CardHeader>
              <CardContent className="grid gap-2">
                {stageOpportunities.length === 0 && (
                  <p className="text-muted-foreground text-xs">Fırsat yok</p>
                )}
                {stageOpportunities.map((o) => (
                  <div key={o.id} className="rounded-lg border p-2.5 text-sm">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <Link to={`/musteriler/${o.customer_id}`} className="font-medium hover:underline">
                        {o.customers?.full_name ?? '—'}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        <CrmOpportunityForm opportunity={o} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => deleteOpportunityMutation.mutate(o.id)}
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">{o.title}</p>
                    {o.amount != null && <p className="text-xs font-medium">{currency(Number(o.amount))}</p>}
                    {o.expected_close_date && (
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(o.expected_close_date), 'd MMM yyyy', { locale: trLocale })}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Aktiviteler</CardTitle>
        </CardHeader>
        <CardContent className={activities.length === 0 ? '' : 'grid gap-1.5'}>
          {activities.length === 0 && <p className="text-muted-foreground p-4 text-sm">Henüz aktivite yok</p>}
          {activities.slice(0, 30).map((activity) => {
            const Icon = activityIcons[activity.activity_type] ?? StickyNote
            return (
              <div key={activity.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/musteriler/${activity.customer_id}`} className="font-medium hover:underline">
                    {activity.customers?.full_name ?? '—'}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {tr.crmActivityType[activity.activity_type]}
                    {activity.subject ? ` — ${activity.subject}` : ''} ·{' '}
                    {format(new Date(activity.occurred_at), 'd MMM yyyy HH:mm', { locale: trLocale })}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteActivityMutation.mutate(activity.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
