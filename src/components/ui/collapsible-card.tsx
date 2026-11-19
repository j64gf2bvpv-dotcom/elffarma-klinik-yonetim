import * as React from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Ayarlar sayfasındaki tek bir bölüm satırı — macOS Sistem Ayarları / Stripe tarzı sade liste: küçük simge, başlık,
 * tek satırlık açıklama ve sağda ok. Tıklayınca içerik satırın altında açılır. Satırlar `SettingsGroup` içinde
 * ince çizgilerle ayrılmış tek bir kutuda durur (kullanıcı isteği, 2026-11-19: "daha profesyonel, sade").
 * `defaultOpen` sadece İLK render'da kullanılır.
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
    <div className={cn('min-w-0', open && 'bg-muted/20')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-accent/50 flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors"
      >
        <span className="flex shrink-0 [&>span]:size-9 [&>span]:rounded-lg [&>span]:transition-none [&>span]:hover:scale-100 [&_svg]:size-[18px]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight font-medium">{title}</div>
          {description && <p className="text-muted-foreground mt-0.5 truncate text-[13px]">{description}</p>}
        </div>
        <ChevronRight
          className={cn('text-muted-foreground/70 size-4 shrink-0 transition-transform duration-200', open && 'rotate-90')}
        />
      </button>
      {open && <div className="border-border/60 border-t px-6 pt-5 pb-6">{children}</div>}
    </div>
  )
}

/** Ayarlar bölümlerini başlıklı tek bir kutuda toplar; içindeki satırlar ince çizgiyle ayrılır */
export function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-muted-foreground px-1 text-xs font-semibold tracking-wide">{label}</h2>
      <div className="bg-card border-border/60 divide-border/60 overflow-hidden rounded-xl border shadow-sm [&>*:empty]:hidden divide-y">
        {children}
      </div>
    </section>
  )
}
