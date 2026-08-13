import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Geniş tablolarda yatay kaydırma çubuğunu her zaman görünür ve erişilebilir
 * kılmak için önceden viewport'a sabitlenen, gerçek scrollLeft ile senkronize
 * özel bir çubuk denenmişti (ResizeObserver + scroll dinleyicileriyle) — ama
 * bu, farklı sayfa/veri kombinasyonlarında güvenilir biçimde çalışmadı
 * (kullanıcı geri bildirimi: birden fazla düzeltmeden sonra bile hâlâ hiç
 * görünmüyordu). Onun yerine tablo kutusu SINIRLI bir yüksekliğe sabitlenip
 * içeride hem yatay hem dikey olarak kaydırılıyor — tarayıcının zaten her
 * zaman görünür yaptığımız native kaydırma çubuğu (bkz. index.css) böylece
 * kutunun alt/sağ kenarında, saf CSS ile garanti altında, her zaman
 * ulaşılabilir bir yerde duruyor; özel JS senkronizasyonuna gerek kalmıyor.
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full max-h-[65vh] overflow-auto rounded-md">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
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
