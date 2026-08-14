import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { Card, CardContent } from './card'
import { cn } from '@/lib/utils'

/**
 * Ayarlar gibi çok sayıda kartın alt alta dizildiği sayfalarda sayfa
 * sayfalarca aşağı inmesin diye — başlık satırına tıklayınca içerik
 * açılıp/kapanıyor. `defaultOpen` sadece İLK render'da kullanılır (kullanıcı
 * durumu değiştirdikten sonra sayfa yeniden render olsa da açık/kapalı
 * durumu korunur).
 */
export function CollapsibleCard({
  icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-6 py-5 text-left"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="leading-none font-semibold">{title}</p>
          {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
        </div>
        <ChevronDown
          className={cn('text-muted-foreground size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}
