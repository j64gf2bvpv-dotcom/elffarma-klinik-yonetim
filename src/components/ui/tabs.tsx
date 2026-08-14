import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null)

  // Sekme sayısı listenin genişliğini aşıp yatay kaydırma gerektiğinde,
  // hangi panelin seçili olduğu kaybolmasın diye aktif sekme her zaman
  // görünüme kaydırılır (Radix, seçim değişince tetiğin data-state'ini
  // senkron günceller — bunu bir MutationObserver ile izliyoruz).
  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    function scrollActiveIntoView() {
      const active = list?.querySelector<HTMLElement>('[data-state="active"]')
      active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }
    scrollActiveIntoView()
    const observer = new MutationObserver(scrollActiveIntoView)
    observer.observe(list, { attributes: true, attributeFilter: ['data-state'], subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        // Tema/renk modundan bağımsız, HER ZAMAN koyu bir çubuk — bg-muted
        // gibi temaya göre açılıp koyulaşan bir token yerine sabit bir koyu
        // renk kullanılıyor ki panel her zaman "koyu" görünsün.
        'scrollbar-hide inline-flex h-9 w-fit max-w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-zinc-900 p-1 text-zinc-400',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-zinc-400 hover:text-zinc-100 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50 inline-flex h-[calc(100%-1px)] shrink-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
