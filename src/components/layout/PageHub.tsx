import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'

export interface HubTab {
  key: string
  label: string
  icon: LucideIcon
  render: () => React.ReactNode
  /** Kullanıcı Panel İzinleri'ndeki eski menü anahtarı — kişiye gizlenmişse sekme de gizli */
  navKey?: string
}

/**
 * Birbiriyle ilgili sayfaları tek menü altında sekmelerle toplar (kullanıcı isteği, 2026-11-19: "ayrı olmasın,
 * içinde olsun, entegre çalışsın" — Cari Kart, Ajanda, Satış Temsilcisi Raporu). Seçili sekme adreste ?bolum=…
 * olarak durur; eski menü adresleri bu sekmelere yönlenir.
 */
export function PageHub({ tabs }: { tabs: HubTab[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { staff } = useAuth()
  const hidden = new Set(staff?.hidden_nav_items ?? [])
  const visible = tabs.filter((t) => !t.navKey || !hidden.has(t.navKey))
  const current = visible.find((t) => t.key === searchParams.get('bolum')) ?? visible[0]
  const select = (key: string) => setSearchParams(key === visible[0]?.key ? {} : { bolum: key }, { replace: true })

  return (
    <div>
      {visible.length > 1 && (
        <div className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1 text-sm">
          {visible.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-medium transition-colors',
                current?.key === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      )}
      {current?.render()}
    </div>
  )
}
