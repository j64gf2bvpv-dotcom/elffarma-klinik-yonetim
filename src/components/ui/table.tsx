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
      data-testid="floating-scrollbar"
      onScroll={onFloatingScroll}
      style={{ position: 'fixed', left: rect.left, width: rect.width, bottom: 0 }}
      className="bg-card border-primary/50 z-40 h-4 overflow-x-auto overflow-y-hidden border-t-2 shadow-[0_-4px_12px_rgba(0,0,0,0.12)]"
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>,
    document.body,
  )
}

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  // Yatay kaydırma TEK bir kutuda ve kendi native çubuğu bilerek gizli
  // (`scrollbar-hide`) — aşağıya sabitlenen kayan çubuk (FloatingScrollbar)
  // zaten bu işi görüyor; ikisi aynı anda görününce tablonun altında üst
  // üste binmiş iki çubuk gibi görünüyordu. Dikey yönde bilerek bir
  // yükseklik sınırı YOK — tablo sayfayla birlikte doğal akışında büyüyor
  // (sayfanın kendisi `<main>` üzerinden kaydırılıyor); bir eksende overflow
  // 'auto', diğeri 'visible' olduğunda CSS otomatik olarak ikisini de 'auto'
  // yapıyor (browser'ın "overflow computed value" kuralı) — bu kutuya bir
  // yükseklik sınırı verilseydi bu kural yüzünden kendi (istenmeyen) dikey
  // çubuğu da çıkardı; sınır vermeyerek bunu zararsız kılıyoruz.
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className="scrollbar-hide relative w-full overflow-x-auto rounded-md"
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn('w-full caption-bottom border-separate border-spacing-0 text-sm', className)}
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

/**
 * `selected` — satıra tıklayınca kalıcı olarak vurgulanmasını sağlar (hover'ın
 * aksine fare pozisyonuna bağlı değil, kaydırırken de kaybolmaz). Sayfa, hangi
 * satırın seçili olduğunu kendi state'inde tutup buraya geçiyor; bu bileşen
 * sadece görsel vurgulamayı standartlaştırıyor. Sol çubuk BİLEREK `border-l`
 * değil `box-shadow: inset` — CSS tablo spesifikasyonu, `border-collapse:
 * separate` (varsayılan) modda `<tr>` üzerindeki sol/sağ border'ları
 * YOKSAYAR (üst/alt border'lar etkilenmiyor, bu yüzden fark edilmesi zor) —
 * gerçek tarayıcıda ölçülüp doğrulandı: `border-l-[6px]` computed genişliği
 * sessizce 0 kalıyordu, box-shadow ise bu kısıtlamaya tabi değil.
 */
function TableRow({ className, selected, ...props }: React.ComponentProps<'tr'> & { selected?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      data-state={selected ? 'selected' : undefined}
      className={cn(
        'hover:bg-accent/40 border-b border-border/60 transition-colors duration-150',
        props.onClick && 'cursor-pointer',
        // bg-primary/25 bazı marka temalarında (primary açık/doygun az ise)
        // yeterince belirgin koyulaşmıyordu — sabit, temadan bağımsız güçlü
        // bir katman kullanılıyor ki seçili satır her zaman net görülsün.
        // Karanlık modda zemin zaten koyu (oklch ~0.16-0.2) olduğu için siyah
        // eklemek neredeyse görünmüyordu — orada beyaz katman kullanılıyor.
        selected && 'bg-black/15 dark:bg-white/12 shadow-[inset_6px_0_0_0_var(--primary)] font-medium',
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
