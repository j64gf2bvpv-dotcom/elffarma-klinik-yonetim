import * as React from 'react'
import { Check, Plus, Trash2, ClipboardList, ListChecks } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useChecklistItems,
  useCreateChecklistItem,
  useCreateChecklistItemsBulk,
  useDeleteChecklistItem,
  useSetChecklistItemDone,
} from './hooks'
import { DEFAULT_CONGRESS_CHECKLIST_ITEMS } from './checklistTemplate'

/**
 * Kongre/workshop'a özel hazırlık kontrol listesi. Liste boşsa "Standart
 * Listeyi Ekle" ile genelde ihtiyaç duyulan maddeler (stand, numune, broşür,
 * konaklama vb.) toplu eklenebilir — ayrıca her zaman serbest madde ekleme
 * kalıyor, sabit liste zorunlu değil. İşaretlenince yeşil tık yanıyor.
 */
export function ChecklistPanel({ congressId }: { congressId: string }) {
  const { data: items = [], isLoading } = useChecklistItems(congressId)
  const createMutation = useCreateChecklistItem(congressId)
  const bulkCreateMutation = useCreateChecklistItemsBulk(congressId)
  const toggleMutation = useSetChecklistItemDone(congressId)
  const deleteMutation = useDeleteChecklistItem(congressId)
  const [draft, setDraft] = React.useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    setDraft('')
    await createMutation.mutateAsync(label)
  }

  const doneCount = items.filter((i) => i.is_done).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-primary" /> Hazırlık Kontrol Listesi
          {items.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({doneCount}/{items.length})
            </span>
          )}
        </h3>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4">
          {isLoading && <p className="text-muted-foreground text-sm">Yükleniyor...</p>}
          {!isLoading && items.length === 0 && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-sm">
                Henüz bir madde yok — ne gitmesi/hazırlanması gerekiyorsa aşağıdan ekleyin, ya da genelde
                ihtiyaç duyulan standart listeyi ekleyip üzerinden düzenleyin.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={bulkCreateMutation.isPending}
                onClick={() => bulkCreateMutation.mutate(DEFAULT_CONGRESS_CHECKLIST_ITEMS)}
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
                  item.is_done ? 'border-success/20 bg-success/5' : 'hover:bg-accent',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate({ id: item.id, is_done: !item.is_done })}
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    item.is_done
                      ? 'border-success bg-success text-success-foreground'
                      : 'border-muted-foreground/30 text-transparent hover:border-success/50',
                  )}
                  title={item.is_done ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <span className={cn('min-w-0 flex-1 truncate', item.is_done && 'text-muted-foreground line-through')}>
                  {item.label}
                </span>
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
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Örn. Broşür, roll-up banner, numune kutusu..."
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!draft.trim() || createMutation.isPending}>
              <Plus className="size-3.5" /> Ekle
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
