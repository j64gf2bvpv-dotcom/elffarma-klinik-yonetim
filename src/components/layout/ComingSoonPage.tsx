import type { LucideIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardContent } from '@/components/ui/card'

export function ComingSoonPage({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="size-8" />
          </span>
          <div>
            <p className="text-lg font-semibold">Bu modül yakında aktif olacak</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              {title} menüsü eklendi; gerçek veri ve işlevler onayınızla modül modül devreye alınacak.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
