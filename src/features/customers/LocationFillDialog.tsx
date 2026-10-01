import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPinned } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { detectLocation, type DetectedLocation } from '@/lib/detectProvince'
import { getErrorMessage } from '@/lib/utils'
import { fetchRegions } from '@/features/regions/api'
import { ensureRegionFor } from '@/features/regions/ensureRegion'
import { updateCustomerLocation } from './api'
import { useCustomers } from './hooks'
import type { Customer } from '@/types/database'

/**
 * Var olan carilerde İL ve/veya BÖLGE boşsa, isimden (başında, içinde ya da
 * sonunda geçen il/ilçe adı), hastane/klinik adından, adresten ya da nottan
 * algılayıp doldurur (kullanıcı istekleri, 2026-10-01 — özellikle rehberden
 * aktarılıp il/bölgesi boş kalan kişiler için). Önizlemede ne yazılacağı
 * görünür, satır satır seçilir. Dolu alanlara DOKUNULMAZ; bölge yoksa il
 * adıyla (ilçe varsa altında ilçe adıyla) otomatik oluşturulur.
 */

interface Candidate {
  customer: Customer
  location: DetectedLocation
  setProvince: boolean
  setDistrict: boolean
  setRegion: boolean
}

export function LocationFillDialog() {
  const queryClient = useQueryClient()
  const { data: customers = [] } = useCustomers('')
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [running, setRunning] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  const candidates = React.useMemo<Candidate[]>(() => {
    const list: Candidate[] = []
    for (const c of customers) {
      const location = detectLocation({ name: c.full_name, org: c.hospital_name, address: c.address, note: c.notes })
      if (!location) continue
      const setProvince = !c.province
      // İlçe sadece il boşsa ya da algılanan ille aynıysa yazılır (farklı ilin ilçesi karışmasın)
      const setDistrict = !c.district && !!location.district && (!c.province || c.province === location.province)
      const setRegion = !c.region_id
      if (!setProvince && !setDistrict && !setRegion) continue
      list.push({ customer: c, location, setProvince, setDistrict, setRegion })
    }
    return list.sort((a, b) => a.location.province.localeCompare(b.location.province, 'tr') || a.customer.full_name.localeCompare(b.customer.full_name, 'tr'))
  }, [customers])

  function openDialog() {
    setSelected(new Set(candidates.map((c) => c.customer.id)))
    setOpen(true)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function apply() {
    const todo = candidates.filter((c) => selected.has(c.customer.id))
    if (todo.length === 0) return
    setRunning(true)
    setProgress(0)
    let done = 0
    const errors: string[] = []
    try {
      const regions = await fetchRegions()
      for (const c of todo) {
        try {
          const patch: { province?: string; district?: string; region_id?: string } = {}
          if (c.setProvince) patch.province = c.location.province
          if (c.setDistrict && c.location.district) patch.district = c.location.district
          if (c.setRegion) patch.region_id = await ensureRegionFor(c.location, regions)
          await updateCustomerLocation(c.customer.id, patch)
          done++
        } catch (err) {
          errors.push(`${c.customer.full_name}: ${getErrorMessage(err)}`)
        }
        setProgress((p) => p + 1)
      }
    } catch (err) {
      errors.push(getErrorMessage(err))
    }
    setRunning(false)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['regions'] }),
    ])
    if (done > 0) toast.success(`${done} kişinin il/ilçe/bölge bilgisi dolduruldu`)
    if (errors.length > 0) toast.error(`${errors.length} kişide hata`, { description: errors.slice(0, 3).join(' • ') })
    else setOpen(false)
  }

  const byProvince = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const c of candidates) m.set(c.location.province, (m.get(c.location.province) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [candidates])

  return (
    <>
      <Button variant="outline" onClick={openDialog} disabled={candidates.length === 0} title={candidates.length === 0 ? 'İsimlerinden il/bölge algılanabilecek, il/bölgesi boş kişi yok' : undefined}>
        <MapPinned /> İsimlerden İl/Bölge Doldur{candidates.length > 0 && ` (${candidates.length})`}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !running && setOpen(next)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>İsimlerden İl / Bölge Doldur</DialogTitle>
            <DialogDescription>
              İl veya bölgesi boş olan {candidates.length} kişinin adında, hastane/klinik adında ya da adresinde il/ilçe
              adı geçiyor. Seçtikleriniz için boş olan İl, İlçe ve Bölge alanları doldurulur (dolu alanlara dokunulmaz);
              bölge yoksa il adıyla — ilçe geçiyorsa "İl / İlçe" alt bölgesiyle — otomatik oluşturulur.
            </DialogDescription>
          </DialogHeader>

          {byProvince.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {byProvince.slice(0, 14).map(([p, n]) => (
                <Badge key={p} variant="secondary">
                  {p}: {n}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-b pb-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={selected.size === candidates.length && candidates.length > 0}
                onCheckedChange={(v) => setSelected(v === true ? new Set(candidates.map((c) => c.customer.id)) : new Set())}
              />
              Tümünü seç
            </label>
            <span className="text-muted-foreground">{selected.size} kişi seçili</span>
          </div>

          <div className="max-h-[45vh] overflow-y-auto">
            {candidates.map((c) => (
              <label key={c.customer.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={selected.has(c.customer.id)} onCheckedChange={() => toggle(c.customer.id)} />
                <span className="min-w-0 flex-1 truncate">{c.customer.full_name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {c.setProvince
                    ? `İl: ${c.location.district ? `${c.location.province} / ${c.location.district}` : c.location.province}`
                    : c.setDistrict
                      ? `İlçe: ${c.location.district}`
                      : 'İl dolu'}
                  {' · '}
                  {c.setRegion
                    ? `Bölge: ${c.location.district ? `${c.location.province} / ${c.location.district}` : c.location.province}`
                    : 'Bölge dolu'}
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Vazgeç
            </Button>
            <Button onClick={apply} disabled={running || selected.size === 0}>
              {running && <Loader2 className="animate-spin" />}
              {running ? `Dolduruluyor ${progress}/${selected.size}` : `${selected.size} Kişiye Uygula`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
