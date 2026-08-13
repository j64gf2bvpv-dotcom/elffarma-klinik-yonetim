import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

/**
 * Tablo pencereden (yatayda) taştığında, sayfada hiç aşağı inmeden ekranın
 * en altına sabit, gerçek scrollLeft ile iki yönlü senkronize bir kaydırma
 * çubuğu gösterir.
 *
 * ÖNEMLİ — önceki iki denemenin neden hiçbir zaman görünmediği: bu bileşen
 * her zaman bir `Card` (bkz. card.tsx) içine render ediliyor, ve `Card`'ın
 * kendisinde `backdrop-blur` var. CSS'te `backdrop-filter` (`filter` gibi),
 * `position: fixed` torunları için YENİ bir "containing block" oluşturur —
 * yani bu çubuk `position: fixed` ile "ekrana" değil, en yakın `backdrop-
 * filter`'lı ataya (Card'a) göre sabitleniyordu, gerçek viewport'a değil.
 * Çözüm: `createPortal` ile doğrudan `document.body`'ye render ediyoruz —
 * hiçbir atanın (Card'ın backdrop-blur'u dahil, gelecekte eklenebilecek
 * transform/filter/contain'ler dahil) containing-block etkisine girmiyor,
 * `position: fixed` gerçekten viewport'a göre sabitleniyor.
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

    // Container'ın kendi kutusu `w-full` olduğu için tablo içeriği (sütun/veri)
    // async yüklenip genişleyince SADECE tablonun kendi genişliği değişir —
    // ikisini de ayrı ayrı gözlemliyoruz.
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(container)
    if (contentRef.current) resizeObserver.observe(contentRef.current)

    // 'scroll' olayı bubble olmadığı için normal bir window dinleyicisi iç
    // içe kaydırılabilir elemanları (sayfanın kendisi, container'ın kendi
    // max-h + overflow-auto kaydırması, vb.) YAKALAYAMAZ. `capture: true` ile
    // dinlemek, hangi eleman kaydırılırsa kaydırılsın (hangi atada/torunda
    // olursa olsun) yakalanmasını sağlıyor — belirli bir "scroll parent"
    // bulmaya çalışmaya (kırılgan, önceki denemede başarısız oldu) gerek yok.
    window.addEventListener('scroll', update, { capture: true, passive: true })
    window.addEventListener('resize', update)

    function onContainerScroll() {
      update()
      if (syncingRef.current || !floatingRef.current) return
      syncingRef.current = true
      floatingRef.current.scrollLeft = container!.scrollLeft
      syncingRef.current = false
    }
    container.addEventListener('scroll', onContainerScroll, { passive: true })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
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

  return createPortal(
    <div
      ref={floatingRef}
      onScroll={onFloatingScroll}
      style={{ position: 'fixed', left: rect.left, width: rect.width, bottom: 0 }}
      className="bg-background/95 border-border/60 supports-[backdrop-filter]:backdrop-blur-sm z-40 h-3 overflow-x-auto overflow-y-hidden border-t"
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>,
    document.body,
  )
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="relative w-full max-h-[65vh] overflow-auto rounded-md"
    >
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
      className={cn(
        'bg-card supports-[backdrop-filter]:backdrop-blur-sm sticky top-0 z-10 [&_tr]:border-b',
        className,
      )}
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
