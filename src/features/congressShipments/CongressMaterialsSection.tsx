import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ImageDown, ListChecks, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useConsumables,
  useCreateConsumable,
  useCreateConsumablesBulk,
  useDeleteConsumable,
  useUpdateConsumable,
} from '@/features/congresses/hooks'
import { setConsumableState } from '@/features/congresses/api'
import { DEFAULT_CONGRESS_CONSUMABLES } from '@/features/congresses/consumablesTemplate'
import { exportMaterialsImage, type MaterialMark } from './exportMaterialsImage'
import type { CongressConsumable } from '@/types/database'

/**
 * Kongre/workshopa götürülen STOK DIŞI malzemeler — üç grup: sarf, tanıtım
 * (afiş/katalog/broşür), ekstra. Her kalemde isim + adet, ✓ (tamam/hazır) ve
 * ✗ (yok/bulunamadı) işareti var; liste PNG olarak dışa aktarılıp çıktı
 * alınabiliyor (kullanıcı istekleri, 2026-09-30).
 *
 * Şema değişikliği YOK: Kongreler modülünün congress_consumables tablosu
 * kullanılıyor (orada "Sarf Malzeme" panelinde de görünür). Grup ve "yok"
 * bilgisi, o tabloda arayüzde hiç kullanılmayan `note` alanında ';' ile
 * ayrılmış sabit işaretlerle tutuluyor ("kategori:tanitim", "yok"); işareti
 * olmayan (eski/standart liste) kayıtlar "sarf" sayılır. ✓ = is_used alanı.
 */
export type MaterialGroup = 'sarf' | 'tanitim' | 'ekstra'

const MISSING_TOKEN = 'yok'

function tokensOf(item: CongressConsumable): string[] {
  return (item.note ?? '').split(';').filter(Boolean)
}

function groupOf(item: CongressConsumable): MaterialGroup {
  const tokens = tokensOf(item)
  if (tokens.includes('kategori:tanitim')) return 'tanitim'
  if (tokens.includes('kategori:ekstra')) return 'ekstra'
  return 'sarf'
}

function markOf(item: CongressConsumable): MaterialMark {
  if (item.is_used) return 'done'
  return tokensOf(item).includes(MISSING_TOKEN) ? 'missing' : 'none'
}

function buildNote(group: MaterialGroup, missing: boolean): string | null {
  const tokens = [group === 'sarf' ? null : `kategori:${group}`, missing ? MISSING_TOKEN : null].filter(Boolean)
  return tokens.length > 0 ? tokens.join(';') : null
}

const MATERIAL_GROUPS: { key: MaterialGroup; title: string; placeholder: string; quick?: string[] }[] = [
  { key: 'sarf', title: 'Sarf Malzemeler', placeholder: 'Örn. İğne 30 Gauge' },
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
  group: (typeof MATERIAL_GROUPS)[number]
  items: CongressConsumable[]
}) {
  const queryClient = useQueryClient()
  const createMutation = useCreateConsumable(congressId)
  const bulkCreateMutation = useCreateConsumablesBulk(congressId)
  const updateMutation = useUpdateConsumable(congressId)
  const deleteMutation = useDeleteConsumable(congressId)
  const stateMutation = useMutation({
    mutationFn: ({ id, mark }: { id: string; mark: MaterialMark }) =>
      setConsumableState(id, { is_used: mark === 'done', note: buildNote(group.key, mark === 'missing') }),
    onMutate: ({ id, mark }) => {
      queryClient.setQueryData<CongressConsumable[]>(['congress_consumables', congressId], (old) =>
        old?.map((i) =>
          i.id === id ? { ...i, is_used: mark === 'done', note: buildNote(group.key, mark === 'missing') } : i,
        ),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['congress_consumables', congressId] }),
    onError: (error: Error) => toast.error('Güncellenemedi', { description: error.message }),
  })
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
    await createMutation.mutateAsync({ name: trimmed, quantity, note: buildNote(group.key, false) })
    nameRef.current?.focus()
  }

  function commitQty(item: CongressConsumable, text: string) {
    const quantity = Math.max(1, Math.round(Number(text)) || 1)
    if (quantity !== item.quantity) updateMutation.mutate({ id: item.id, input: { name: item.name, quantity } })
  }

  function commitName(item: CongressConsumable, text: string) {
    const next = text.trim()
    if (next && next !== item.name) updateMutation.mutate({ id: item.id, input: { name: next, quantity: item.quantity } })
  }

  const total = items.reduce((sum, i) => sum + i.quantity, 0)
  const doneCount = items.filter((i) => markOf(i) === 'done').length
  const missingCount = items.filter((i) => markOf(i) === 'missing').length

  return (
    <div className="grid content-start gap-2 rounded-md border bg-background/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{group.title}</h4>
        {items.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {doneCount}/{items.length} tamam
            {missingCount > 0 && <span className="text-destructive"> · {missingCount} yok</span>} · {total} adet
          </span>
        )}
      </div>

      {items.length === 0 && <p className="text-muted-foreground text-xs">Henüz eklenmedi.</p>}

      <div className="grid gap-1">
        {items.map((item) => {
          const mark = markOf(item)
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 rounded px-1 py-0.5 text-sm',
                mark === 'done' && 'bg-success/5',
                mark === 'missing' && 'bg-destructive/5',
                mark === 'none' && 'hover:bg-accent',
              )}
            >
              <button
                type="button"
                onClick={() => stateMutation.mutate({ id: item.id, mark: mark === 'done' ? 'none' : 'done' })}
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  mark === 'done'
                    ? 'border-success bg-success text-success-foreground'
                    : 'border-muted-foreground/30 text-transparent hover:border-success/60 hover:text-success/60',
                )}
                title={mark === 'done' ? 'Tamam işaretini kaldır' : 'Tamam / hazır olarak işaretle'}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => stateMutation.mutate({ id: item.id, mark: mark === 'missing' ? 'none' : 'missing' })}
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  mark === 'missing'
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-muted-foreground/30 text-transparent hover:border-destructive/60 hover:text-destructive/60',
                )}
                title={mark === 'missing' ? 'Yok işaretini kaldır' : 'Yok / bulunamadı olarak işaretle'}
              >
                <X className="size-3.5" strokeWidth={3} />
              </button>
              {/* İsim yerinde düzenlenebilir (kullanıcı isteği, 2026-09-30) —
                  tıklayıp yazın, Enter ya da başka yere tıklayınca kaydedilir. */}
              <Input
                defaultValue={item.name}
                key={`name-${item.id}-${item.name}`}
                onBlur={(e) => commitName(item, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') {
                    e.currentTarget.value = item.name
                    e.currentTarget.blur()
                  }
                }}
                className={cn(
                  'h-7 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-input focus-visible:border-input focus-visible:bg-background',
                  mark === 'missing' && 'text-destructive',
                )}
                title="İsmi düzenlemek için tıklayın"
              />
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
          )
        })}
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

/**
 * `groups` ile hangi listelerin gösterileceği seçilir — Sarf Malzeme kendi
 * menüsünde tek başına, afiş/katalog/broşür + ekstra ayrı menüde birlikte.
 * PNG dışa aktarma sadece gösterilen listeleri içerir.
 */
export function CongressMaterialsSection({
  congressId,
  congressLabel,
  groups,
  exportTitle,
}: {
  congressId: string
  congressLabel: string
  groups: MaterialGroup[]
  exportTitle: string
}) {
  const { data: items = [], isLoading } = useConsumables(congressId)

  const byGroup = React.useMemo(() => {
    const map: Record<MaterialGroup, CongressConsumable[]> = { sarf: [], tanitim: [], ekstra: [] }
    for (const item of items) map[groupOf(item)].push(item)
    return map
  }, [items])

  if (isLoading) return <p className="text-muted-foreground text-sm">Yükleniyor...</p>

  const shown = MATERIAL_GROUPS.filter((g) => groups.includes(g.key))
  const shownCount = shown.reduce((sum, g) => sum + byGroup[g.key].length, 0)

  function handleExport() {
    exportMaterialsImage(
      congressLabel,
      exportTitle,
      shown.map((g) => ({
        title: g.title,
        rows: byGroup[g.key].map((i) => ({ name: i.name, quantity: i.quantity, mark: markOf(i) })),
      })),
      `${exportTitle}-${congressLabel}`.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]+/gi, '-').replace(/^-|-$/g, ''),
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          ✓ tamam / hazır · ✗ yok / bulunamadı — aynı işarete tekrar tıklayınca kalkar.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={shownCount === 0}>
          <ImageDown className="size-3.5" /> PNG Olarak Dışa Aktar
        </Button>
      </div>
      <div className={cn('grid gap-3', shown.length > 1 && 'lg:grid-cols-2')}>
        {shown.map((g) => (
          <MaterialList key={g.key} congressId={congressId} group={g} items={byGroup[g.key]} />
        ))}
      </div>
    </div>
  )
}
