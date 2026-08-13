import * as React from 'react'

import { cn } from '@/lib/utils'

function findScrollableAncestor(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null
  while (node) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return window
}

/**
 * Tablo pencereden (yatayda) taştığında, viewport'un en altına sabitlenen ve
 * gerçek scrollLeft ile iki yönlü senkronize ince bir kaydırma çubuğu
 * gösterir — tablo görünür olduğu sürece HER ZAMAN, sadece tablonun kendi
 * (en alttaki) native çubuğu ekran dışındayken değil (kullanıcı geri
 * bildirimi: her zaman görünür olmalı, sayfanın neresinde olursa olsun).
 */
function FloatingScrollbar({
  containerRef,
  contentRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLTableElement | null>
}) {
  const floatingRef = React.useRef<HTMLDivElement>(null)
  const [rect, setRect] = React.useState<{ left: number; width: number } | null>(null)
  const [contentWidth, setContentWidth] = React.useState(0)
  const syncingRef = React.useRef(false)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function update() {
      const box = container!.getBoundingClientRect()
      const overflows = container!.scrollWidth > container!.clientWidth + 1
      const show = overflows && box.top < window.innerHeight && box.bottom > 0
      setContentWidth(container!.scrollWidth)
      setRect(show ? { left: Math.max(box.left, 0), width: box.width } : null)
    }

    update()

    const scrollParent = findScrollableAncestor(container)
    // Container'ın kendi kutusu `w-full` olduğu için dıştan boyutu sabit kalır;
    // tablo içeriği (sütun/veri) genişleyince SADECE tablonun kendi genişliği
    // değişir, container'ın değil. Container'ı gözlemlemek bu yüzden yetersiz —
    // veriler async yüklenip tablo genişleyince (`ResizeObserver` container'ın
    // kutu boyutunda değişiklik görmediği için) çubuk hiç belirmiyordu. Hem
    // container'ı (mevcut alan değişince) hem gerçek `<table>` elemanını
    // (içerik genişliği değişince) ayrı ayrı gözlemliyoruz.
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(container)
    if (contentRef.current) resizeObserver.observe(contentRef.current)
    scrollParent.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })

    function onContainerScroll() {
      if (syncingRef.current || !floatingRef.current) return
      syncingRef.current = true
      floatingRef.current.scrollLeft = container!.scrollLeft
      syncingRef.current = false
    }
    container.addEventListener('scroll', onContainerScroll, { passive: true })

    return () => {
      resizeObserver.disconnect()
      scrollParent.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      container.removeEventListener('scroll', onContainerScroll)
    }
  }, [containerRef, contentRef])

  function onFloatingScroll() {
    if (syncingRef.current || !containerRef.current || !floatingRef.current) return
    syncingRef.current = true
    containerRef.current.scrollLeft = floatingRef.current.scrollLeft
    syncingRef.current = false
  }

  if (!rect) return null

  return (
    <div
      ref={floatingRef}
      onScroll={onFloatingScroll}
      style={{ position: 'fixed', left: rect.left, width: rect.width, bottom: 0 }}
      className="bg-background/90 border-border/60 supports-[backdrop-filter]:backdrop-blur-sm z-40 h-3 overflow-x-auto overflow-y-hidden border-t"
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  )
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  return (
    <div ref={containerRef} data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        ref={tableRef}
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
      <FloatingScrollbar containerRef={containerRef} contentRef={tableRef} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('bg-muted/40 supports-[backdrop-filter]:backdrop-blur-sm [&_tr]:border-b', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-accent/40 data-[state=selected]:bg-muted border-b border-border/60 transition-colors duration-150',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-10 px-3 text-left align-middle text-xs font-semibold tracking-wide uppercase whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
