import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatTrPhoneForDisplay } from '@/features/whatsapp/normalizePhone'
import { getErrorMessage } from '@/lib/utils'
import { executeDedupe, planDedupe, type DuplicateGroup } from './dedupe'
import type { Customer } from '@/types/database'

/**
 * "Yinelenenleri Sil" — tüm yinelenen kayıt gruplarında tek kayıt bırakıp
 * fazlalıkları siler; kullanıcı açık onay vermeden hiçbir şey silinmez
 * (kullanıcı isteği, 2026-10-02). Kurallar için bkz. dedupe.ts.
 */
export function DuplicateCleanupDialog({ customers, count }: { customers: Customer[]; count: number }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [groups, setGroups] = React.useState<DuplicateGroup[]>([])
  const [confirmed, setConfirmed] = React.useState(false)

  async function openDialog() {
    setOpen(true)
    setConfirmed(false)
    setLoading(true)
    try {
      setGroups(await planDedupe(customers))
    } catch (err) {
      toast.error('Yinelenenler hesaplanamadı', { description: getErrorMessage(err) })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const toDelete = groups.reduce((sum, g) => sum + g.extras.length, 0)
  const blocked = groups.reduce((sum, g) => sum + g.blocked.length, 0)

  async function run() {
    setRunning(true)
    setProgress(0)
    try {
      const deleted = await executeDedupe(groups, setProgress)
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(`${deleted} yinelenen kayıt silindi, her grupta tek kayıt kaldı`)
      setOpen(false)
    } catch (err) {
      toast.error('Silme yarıda kaldı', { description: getErrorMessage(err) })
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
    } finally {
      setRunning(false)
    }
  }

  const phone = (c: Customer) => (c.phone ? formatTrPhoneForDisplay(c.phone) : 'numarasız')

  return (
    <>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={openDialog} disabled={count === 0}>
        <Trash2 /> Yinelenenleri Sil
      </Button>
      <Dialog open={open} onOpenChange={(next) => !running && setOpen(next)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yinelenen Kayıtları Sil</DialogTitle>
            <DialogDescription>
              Aynı isimdeki ya da aynı numaradaki kayıtlarda her gruptan tek kayıt kalır (bağlı satış/tahsilatı ve dolu
              bilgisi en çok olan). Silinenlerdeki farklı numaralar kalan kaydın Notlar'ına, boş alanlar da kalan
              kayda aktarılır. Bağlı satış/tahsilat/faturası olan kayıtlar silinmez.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Yinelenenler hesaplanıyor...
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Yinelenen kayıt yok.</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-semibold">{groups.length}</span> grup ·{' '}
                <span className="font-semibold text-destructive">{toDelete}</span> kayıt silinecek
                {blocked > 0 && <span className="text-muted-foreground"> · {blocked} kayıt bağlı işlemi olduğu için silinmeyecek</span>}
              </p>
              <div className="max-h-[45vh] overflow-y-auto rounded-md border text-sm">
                {groups.map((g) => (
                  <div key={g.keep.id} className="border-b px-3 py-2 last:border-b-0">
                    <p>
                      <span className="text-success font-medium">Kalacak:</span> {g.keep.full_name}{' '}
                      <span className="text-muted-foreground">({phone(g.keep)})</span>
                    </p>
                    {g.extras.map((e) => (
                      <p key={e.id} className="text-destructive">
                        Silinecek: {e.full_name} <span className="opacity-70">({phone(e)})</span>
                      </p>
                    ))}
                    {g.blocked.map((e) => (
                      <p key={e.id} className="text-muted-foreground">
                        Silinmeyecek (bağlı işlemi var): {e.full_name} ({phone(e)})
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} disabled={running} />
                {toDelete} kaydın kalıcı olarak silineceğini anladım
              </label>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={run} disabled={running || loading || toDelete === 0 || !confirmed}>
              {running && <Loader2 className="animate-spin" />}
              {running ? `Siliniyor ${progress}/${groups.length} grup` : `Tümünü Sil (${toDelete})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
