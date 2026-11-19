import { Loader2, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Tablolarda seçili kayıtlar için toplu silme çubuğu (kullanıcı isteği, 2026-11-19: "giderlerde kayıtları tek ve
 * toplu sil"). Seçim yokken görünmez.
 */
export function BulkDeleteBar({
  count,
  total,
  busy,
  onDelete,
  onClear,
}: {
  count: number
  total?: string
  busy?: boolean
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm">
      <span className="font-medium">
        {count} kayıt seçildi{total && <span className="text-muted-foreground"> · {total}</span>}
      </span>
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          <X className="size-3.5" /> Seçimi kaldır
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Seçilenleri Sil
        </Button>
      </div>
    </div>
  )
}
