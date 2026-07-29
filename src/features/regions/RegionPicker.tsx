import * as React from 'react'
import { Plus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCreateRegion, useRegions } from './hooks'
import type { Region } from '@/types/database'

const NONE = '__none__'

function regionLabel(region: Region, byId: Map<string, Region>): string {
  const parent = region.parent_region_id ? byId.get(region.parent_region_id) : undefined
  return parent ? `${parent.name} / ${region.name}` : region.name
}

interface RegionPickerProps {
  value: string | null | undefined
  onChange: (regionId: string | null) => void
}

export function RegionPicker({ value, onChange }: RegionPickerProps) {
  const { data: regions = [] } = useRegions()
  const createMutation = useCreateRegion()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [parentId, setParentId] = React.useState<string>(NONE)

  const byId = React.useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions])
  const sorted = React.useMemo(
    () => [...regions].sort((a, b) => regionLabel(a, byId).localeCompare(regionLabel(b, byId), 'tr')),
    [regions, byId],
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const created = await createMutation.mutateAsync({
      name: name.trim(),
      parent_region_id: parentId === NONE ? null : parentId,
    })
    onChange(created.id)
    setName('')
    setParentId(NONE)
    setOpen(false)
  }

  return (
    <div className="flex gap-2">
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Bölge seçin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Belirtilmedi</SelectItem>
          {sorted.map((region) => (
            <SelectItem key={region.id} value={region.id}>
              {regionLabel(region, byId)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon" title="Yeni bölge">
            <Plus className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Bölge</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Üst Bölge (opsiyonel — örn. il seçip altına ilçe eklenebilir)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Yok (üst düzey — örn. il)</SelectItem>
                  {sorted.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {regionLabel(region, byId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region-name">Bölge Adı</Label>
              <Input
                id="region-name"
                placeholder="Örn. İstanbul veya Kadıköy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending && <Loader2 className="animate-spin" />}
                Ekle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
