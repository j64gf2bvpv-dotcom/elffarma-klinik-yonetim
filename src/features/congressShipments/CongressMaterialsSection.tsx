import * as React from 'react'
import { Check, ListChecks, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useConsumables,
  useCreateConsumable,
  useCreateConsumablesBulk,
  useDeleteConsumable,
  useSetConsumableUsed,
  useUpdateConsumable,
} from '@/features/congresses/hooks'
import { DEFAULT_CONGRESS_CONSUMABLES } from '@/features/congresses/consumablesTemplate'
import type { CongressConsumable } from '@/types/database'

/**
 * Kongre/workshopa götürülen STOK DIŞI malzemeler (kullanıcı isteği,
 * 2026-09-30: "giden sarf malzemeler adetleri isimleri, götürülen afiş
 * katalog broşür adet isimleri olsun, bir de gerekli malzeme eklenebilsin
 * ekstra menüde") — üç grup: sarf, tanıtım (afiş/katalog/broşür), ekstra.
 *
 * Şema değişikliği YOK: Kongreler modülünün congress_consumables tablosu
 * kullanılıyor (orada "Sarf Malzeme" panelinde de görünür). Grup bilgisi,
 * o tabloda arayüzde hiç kullanılmayan `note` alanında sabit bir işaretle
 * tutuluyor; işareti olmayan (eski/standart liste) kayıtlar "sarf" sayılır.
 */
type MaterialGroup = 'sarf' | 'tanitim' | 'ekstra'

const GROUP_NOTE: Record<MaterialGroup, string | null> = {
  sarf: null,
  tanitim: 'kategori:tanitim',
  ekstra: 'kategori:ekstra',
}

function groupOf(item: CongressConsumable): MaterialGroup {
  if (item.note === GROUP_NOTE.tanitim) return 'tanitim'
  if (item.note === GROUP_NOTE.ekstra) return 'ekstra'
  return 'sarf'
}

const GROUPS: { key: MaterialGroup; title: string; placeholder: string; quick?: string[] }[] = [
  { key: 'sarf', title: 'Sarf Malzemeler', placeholder: 'Örn. Steril eldiven' },
  {
    key: 'tanitim',
    title: 'Afiş / Katalog / Broşür',
    placeholder: 'Örn. MIXO broşürü',
    quick: ['Afiş', 'Katalog', 'Broşür', 'Roll-up'],
  },
  { key: 'ekstra', title: 'Ekstra / Gerekli Malzemeler', placeholder: 'Örn. Uzatma kablosu' },
]

function MaterialList({
  congressId,
  group,
  items,
}: {
  congressId: string
  group: (typeof GROUPS)[number]
  items: CongressConsumable[]
}) {
  const createMutation = useCreateConsumable(congressId)
  const bulkCreateMutation = useCreateConsumablesBulk(congressId)
  const updateMutation = useUpdateConsumable(congressId)
  const deleteMutation = useDeleteConsumable(congressId)
  // Tamamlandı tiki (kullanıcı isteği, 2026-09-30) — congress_consumables.is_used
  // alanı; Kongreler modülündeki "kullanıldı" işaretiyle aynı alan.
  const toggleMutation = useSetConsumableUsed(congressId)
  const [name, setName] = React.useState('')
  const [qty, setQty] = React.useState('1')
  const nameRef = React.useRef<HTMLInputElement>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const quantity = Math.max(1, Math.round(Number(qty)) || 1)
    setName('')
    setQty('1')
    await createMutation.mutateAsync({ name: trimmed, quantity, note: GROUP_NOTE[group.key] })
  }

  function commitQty(item: CongressConsumable, text: string) {
    const quantity = Math.max(1, Math.round(Number(text)) || 1)
    if (quantity !== item.quantity) updateMutation.mutate({ id: item.id, input: { name: item.name, quantity } })
  }

  const total = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="grid content-start gap-2 rounded-md border bg-background/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{group.title}</h4>
        {items.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {items.filter((i) => i.is_used).length}/{items.length} tamam · {total} adet
          </span>
        )}
      </div>

      {items.length === 0 && <p className="text-muted-foreground text-xs">Henüz eklenmedi.</p>}

      <div className="grid gap-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'group flex items-center gap-2 rounded px-1 py-0.5 text-sm',
              item.is_used ? 'bg-success/5' : 'hover:bg-accent',
            )}
          >
            <button
              type="button"
              onClick={() => toggleMutation.mutate({ id: item.id, is_used: !item.is_used })}
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                item.is_used
                  ? 'border-success bg-success text-success-foreground'
                  : 'border-muted-foreground/30 text-transparent hover:border-success/50',
              )}
              title={item.is_used ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </button>
            <span className={cn('min-w-0 flex-1 break-words', item.is_used && 'text-muted-foreground line-through')}>
              {item.name}
            </span>
            <Input
              type="number"
              min="1"
              defaultValue={item.quantity}
              key={`${item.id}-${item.quantity}`}
              onBlur={(e) => commitQty(item, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="h-7 w-16 shrink-0 px-2 text-xs"
              title="Adet"
            />
            <button
              type="button"
              onClick={() => deleteMutation.mutate(item.id)}
              className="text-muted-foreground shrink-0 hover:text-destructive"
              title="Sil"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {group.quick && (
        <div className="flex flex-wrap gap-1">
          {group.quick.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setName(q + ' — ')
                nameRef.current?.focus()
              }}
            >
              {q}
            </Button>
          ))}
        </div>
      )}

      {group.key === 'sarf' && items.length === 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={bulkCreateMutation.isPending}
          onClick={() => bulkCreateMutation.mutate(DEFAULT_CONGRESS_CONSUMABLES)}
        >
          <ListChecks className="size-3.5" /> Standart Listeyi Ekle
        </Button>
      )}

      <form onSubmit={handleAdd} className="flex gap-1.5">
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={group.placeholder}
          className="h-8 min-w-0 flex-1 text-sm"
        />
        <Input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-8 w-16 px-2 text-sm"
          title="Adet"
        />
        <Button type="submit" size="sm" className="h-8" disabled={!name.trim() || createMutation.isPending}>
          <Plus className="size-3.5" /> Ekle
        </Button>
      </form>
    </div>
  )
}

export function CongressMaterialsSection({ congressId }: { congressId: string }) {
  const { data: items = [], isLoading } = useConsumables(congressId)

  const byGroup = React.useMemo(() => {
    const map: Record<MaterialGroup, CongressConsumable[]> = { sarf: [], tanitim: [], ekstra: [] }
    for (const item of items) map[groupOf(item)].push(item)
    return map
  }, [items])

  if (isLoading) return <p className="text-muted-foreground text-sm">Yükleniyor...</p>

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {GROUPS.map((g) => (
        <MaterialList key={g.key} congressId={congressId} group={g} items={byGroup[g.key]} />
      ))}
    </div>
  )
}
