import * as React from 'react'
import { Check, ChevronsUpDown, MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { trFold } from '@/lib/detectProvince'
import { ALL_PROVINCES, REGION_PREFIX, provinceFilterLabel, turkeyRegions } from '@/lib/turkeyRegions'

/**
 * Cari Kart bölge / il filtresi (kullanıcı isteği, 2026-10-19): 7 coğrafi
 * bölge, altında illeri. Bölge satırına tıklayınca o bölgedeki tüm illerin
 * carileri, ile tıklayınca sadece o il listelenir. Üstteki kutuya il ya da
 * bölge adı yazılınca liste daralır (Türkçe karakter / büyük-küçük harf
 * farkı yok sayılır: "izmir" → İzmir). Yanındaki sayı o yerdeki cari sayısı.
 */
export function RegionProvinceFilter({
  value,
  onChange,
  provinceCounts,
}: {
  value: string
  onChange: (value: string) => void
  provinceCounts: Map<string, number>
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const q = trFold(search).trim()

  const groups = React.useMemo(
    () =>
      turkeyRegions
        .map((region) => {
          const regionMatch = !q || trFold(region.name).includes(q)
          const provinces = regionMatch ? region.provinces : region.provinces.filter((il) => trFold(il).includes(q))
          const count = region.provinces.reduce((sum, il) => sum + (provinceCounts.get(il) ?? 0), 0)
          return { region, regionMatch, provinces, count }
        })
        .filter((g) => g.regionMatch || g.provinces.length > 0),
    [q, provinceCounts],
  )

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setSearch('')
  }

  const countLabel = (n: number | undefined) => (n ? <span className="text-muted-foreground ml-auto text-xs tabular-nums">{n}</span> : null)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-52 justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <MapPin className="size-4 text-muted-foreground" />
            {provinceFilterLabel(value)}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="İl veya bölge ara..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-96">
            <CommandEmpty>Eşleşen il ya da bölge yok</CommandEmpty>
            {!q && (
              <CommandGroup>
                <CommandItem value={ALL_PROVINCES} onSelect={() => pick(ALL_PROVINCES)}>
                  <Check className={cn('size-4', value === ALL_PROVINCES ? 'opacity-100' : 'opacity-0')} />
                  Tüm Bölgeler / İller
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map(({ region, regionMatch, provinces, count }) => (
              // Bölge adı aramayla eşleşmiyorsa (il yazıldıysa) bölge satırı
              // sadece başlık olur — Enter ilk eşleşen İLİ seçsin diye.
              <CommandGroup key={region.name} heading={regionMatch ? undefined : `${region.name} Bölgesi`}>
                {regionMatch && (
                  <CommandItem
                    value={`${REGION_PREFIX}${region.name}`}
                    onSelect={() => pick(`${REGION_PREFIX}${region.name}`)}
                    className="bg-destructive/10 font-bold text-destructive data-[selected=true]:bg-destructive/15 data-[selected=true]:text-destructive"
                  >
                    <Check className={cn('size-4', value === `${REGION_PREFIX}${region.name}` ? 'opacity-100' : 'opacity-0')} />
                    {region.name} Bölgesi
                    {countLabel(count)}
                  </CommandItem>
                )}
                {provinces.map((il) => (
                  <CommandItem key={il} value={il} onSelect={() => pick(il)} className="pl-6">
                    <Check className={cn('size-4', value === il ? 'opacity-100' : 'opacity-0')} />
                    {il}
                    {countLabel(provinceCounts.get(il))}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
