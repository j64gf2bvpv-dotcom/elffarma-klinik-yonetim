import * as React from 'react'
import { Check, Plus, Trash2, PackagePlus, ListChecks } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ExportMenu } from '@/components/ExportMenu'
import { cn } from '@/lib/utils'
import type { CongressConsumable } from '@/types/database'
import {
  useConsumables,
  useCreateConsumable,
  useCreateConsumablesBulk,
  useDeleteConsumable,
  useSetConsumableUsed,
  useUpdateConsumable,
} from './hooks'
import { DEFAULT_CONGRESS_CONSUMABLES } from './consumablesTemplate'

/**
 * Kongre/workshop için stok dışı, manuel eklenen sarf malzeme listesi
 * (eldiven, gazlı bez, iğne, kanül vb.) — congress_stock_items'taki gerçek
 * ürünlerden bilerek ayrı. "Standart Listeyi Ekle" ile hazır 20 maddelik
 * liste tek seferde eklenir, adetler sonradan düzenlenebilir.
 */
export function ConsumablesPanel({ congressId }: { congressId: string }) {
  const { data: items = [], isLoading } = useConsumables(congressId)
  const createMutation = useCreateConsumable(congressId)
  const bulkCreateMutation = useCreateConsumablesBulk(congressId)
  const updateMutation = useUpdateConsumable(congressId)
  const toggleMutation = useSetConsumableUsed(congressId)
  const deleteMutation = useDeleteConsumable(congressId)

  const [draftName, setDraftName] = React.useState('')
  const [draftQty, setDraftQty] = React.useState('1')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editQty, setEditQty] = React.useState('1')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = draftName.trim()
    if (!name) return
    const quantity = Math.max(1, Number(draftQty) || 1)
    setDraftName('')
    setDraftQty('1')
    await createMutation.mutateAsync({ name, quantity })
  }

  function startEditQty(item: CongressConsumable) {
    setEditingId(item.id)
    setEditQty(String(item.quantity))
  }

  async function commitEditQty(item: CongressConsumable) {
    const quantity = Math.max(1, Number(editQty) || 1)
    setEditingId(null)
    if (quantity === item.quantity) return
    await updateMutation.mutateAsync({ id: item.id, input: { name: item.name, quantity } })
  }

  const usedCount = items.filter((i) => i.is_used).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <PackagePlus className="size-4 text-primary" /> Sarf Malzeme
          {items.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({usedCount}/{items.length} kullanıldı)
            </span>
          )}
        </h3>
        {items.length > 0 && (
          <ExportMenu<CongressConsumable>
            title="Sarf Malzeme"
            filename="sarf-malzeme"
            rows={items}
            columns={[
              { header: 'Malzeme', value: (i) => i.name },
              { header: 'Adet', value: (i) => i.quantity },
              { header: 'Durum', value: (i) => (i.is_used ? 'Kullanıldı' : 'Bekliyor') },
            ]}
          />
        )}
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4">
          {isLoading && <p className="text-muted-foreground text-sm">Yükleniyor...</p>}
          {!isLoading && items.length === 0 && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-sm">
                Henüz sarf malzeme eklenmedi — tek tek ekleyin, ya da genelde ihtiyaç duyulan standart
                listeyi (eldiven, gazlı bez, iğne, kanül vb.) toplu ekleyip adetleri düzenleyin.
              </p>
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
            </div>
          )}
          <div className="grid gap-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                  item.is_used ? 'border-success/20 bg-success/5' : 'hover:bg-accent',
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
                  title={item.is_used ? 'Kullanılmadı olarak işaretle' : 'Kullanıldı olarak işaretle'}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <span className={cn('min-w-0 flex-1 truncate', item.is_used && 'text-muted-foreground line-through')}>
                  {item.name}
                </span>
                {editingId === item.id ? (
                  <Input
                    type="number"
                    min="1"
                    autoFocus
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    onBlur={() => commitEditQty(item)}
                    onKeyDown={(e) => e.key === 'Enter' && commitEditQty(item)}
                    className="h-7 w-16 shrink-0 px-2 text-xs"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditQty(item)}
                    className="text-muted-foreground shrink-0 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
                    title="Adedi düzenle"
                  >
                    {item.quantity} adet
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  title="Sil"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Örn. Steril eldiven"
              className="flex-1"
            />
            <Input
              type="number"
              min="1"
              value={draftQty}
              onChange={(e) => setDraftQty(e.target.value)}
              className="w-20"
            />
            <Button type="submit" size="sm" disabled={!draftName.trim() || createMutation.isPending}>
              <Plus className="size-3.5" /> Ekle
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
