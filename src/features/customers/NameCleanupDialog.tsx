import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildSpellingDictionary, cleanDoctorName, type CleanedName } from '@/lib/cleanDoctorName'
import { trFold } from '@/lib/detectProvince'
import { getErrorMessage } from '@/lib/utils'
import { fetchRegions } from '@/features/regions/api'
import { ensureRegionFor } from '@/features/regions/ensureRegion'
import { updateCustomerFields, type CustomerInput } from './api'
import { useCustomers } from './hooks'
import type { Customer } from '@/types/database'

/**
 * Cari adlarını toplu düzeltme (kullanıcı isteği, 2026-10-19: "Dr. Ahmet Yılmaz
 * gibi olsun, arada bölge yazmasın"). Kural `cleanDoctorName`'de; burada
 * önizleme (eski → yeni) gösterilir, değişecek herkes seçili gelir. İsimden
 * çıkarılan il/ilçe kaybolmasın diye carinin İl / İlçe / Bölge alanı BOŞSA oraya
 * yazılır; "Adana Eğitim" gibi kurum bilgisi Hastane alanı boşsa oraya, isimden
 * çıkan notlar ("Ahmet Hoca Workshop", parantez içi) Not alanına eklenir.
 */

interface Candidate {
  customer: Customer
  cleaned: CleanedName
  patch: Partial<CustomerInput>
  /** önizlemede gösterilen ek bilgi ("İl: Adana · Hastane: Adana Eğitim") */
  extra: string
}

function buildCandidates(customers: Customer[]): Candidate[] {
  const dict = buildSpellingDictionary(customers.map((c) => c.full_name))
  const list: Candidate[] = []
  for (const c of customers) {
    const cleaned = cleanDoctorName(c.full_name, dict)
    if (cleaned.name === c.full_name.trim()) continue
    const patch: Partial<CustomerInput> = { full_name: cleaned.name }
    const extra: string[] = []
    const loc = cleaned.location
    if (loc && !c.province) {
      patch.province = loc.province
      if (loc.district && !c.district) patch.district = loc.district
      extra.push(`İl: ${loc.district ? `${loc.province} / ${loc.district}` : loc.province}`)
    }
    if (cleaned.note) {
      patch.notes = [c.notes, cleaned.note].filter(Boolean).join('\n')
      extra.push(`Not: ${cleaned.note}`)
    }
    if (cleaned.prefix && !c.hospital_name) {
      patch.hospital_name = loc ? `${loc.province} ${cleaned.prefix}` : cleaned.prefix
      extra.push(`Hastane: ${patch.hospital_name}`)
    }
    list.push({ customer: c, cleaned, patch, extra: extra.join(' · ') })
  }
  return list.sort((a, b) => a.cleaned.name.localeCompare(b.cleaned.name, 'tr'))
}

export function NameCleanupDialog() {
  const queryClient = useQueryClient()
  const { data: customers = [] } = useCustomers('')
  const [open, setOpen] = React.useState(false)
  const [candidates, setCandidates] = React.useState<Candidate[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState('')
  const [running, setRunning] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  // Düğmedeki sayı için — liste açılırken yeniden hesaplanır
  const pendingCount = React.useMemo(() => buildCandidates(customers).length, [customers])

  function openDialog() {
    const list = buildCandidates(customers)
    setCandidates(list)
    setSelected(new Set(list.map((c) => c.customer.id)))
    setSearch('')
    setOpen(true)
  }

  const visible = React.useMemo(() => {
    const q = trFold(search).trim()
    if (!q) return candidates
    return candidates.filter((c) => trFold(c.customer.full_name).includes(q) || trFold(c.cleaned.name).includes(q))
  }, [candidates, search])

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
    const regions = await fetchRegions().catch(() => null)
    for (const c of todo) {
      try {
        const patch = { ...c.patch }
        if (c.cleaned.location && !c.customer.region_id && regions) {
          patch.region_id = await ensureRegionFor(c.cleaned.location, regions)
        }
        await updateCustomerFields(c.customer.id, patch)
        done++
      } catch (err) {
        errors.push(`${c.customer.full_name}: ${getErrorMessage(err)}`)
      }
      setProgress((p) => p + 1)
    }
    setRunning(false)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['regions'] }),
    ])
    if (done > 0) toast.success(`${done} kişinin adı düzeltildi`)
    if (errors.length > 0) toast.error(`${errors.length} kişide hata`, { description: errors.slice(0, 3).join(' • ') })
    else setOpen(false)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={openDialog}
        disabled={pendingCount === 0}
        title={pendingCount === 0 ? 'Düzeltilecek isim yok' : 'İsimlerdeki il/bölge adlarını kaldır, "Dr. Ad Soyad" biçimine getir'}
      >
        <Wand2 /> İsimleri Düzelt{pendingCount > 0 && ` (${pendingCount})`}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !running && setOpen(next)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>İsimleri Düzelt</DialogTitle>
            <DialogDescription>
              {candidates.length} kişinin adı "Dr. Deniz Demir" biçimine getirilecek: araya yazılmış il / semt adları
              ("Dr. Antep Deniz Demir", "Adana Eğitim Dr. …") kaldırılır, unvan başa alınır, harfler düzeltilir. İsimden
              çıkan il, carinin İl alanı boşsa oraya yazılır. İstemediklerinizin işaretini kaldırın.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İsim ara..." className="pl-8" />
          </div>

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
            {visible.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Eşleşen kişi yok.</p>}
            {visible.map((c) => (
              <label key={c.customer.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox className="mt-0.5" checked={selected.has(c.customer.id)} onCheckedChange={() => toggle(c.customer.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="text-muted-foreground line-through">{c.customer.full_name}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className="font-medium">{c.cleaned.name}</span>
                  </p>
                  {c.extra && <p className="text-muted-foreground truncate text-xs">{c.extra}</p>}
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Vazgeç
            </Button>
            <Button onClick={apply} disabled={running || selected.size === 0}>
              {running && <Loader2 className="animate-spin" />}
              {running ? `Düzeltiliyor ${progress}/${selected.size}` : `${selected.size} İsmi Düzelt`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
