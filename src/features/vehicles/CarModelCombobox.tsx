import * as React from 'react'
import { Car, Check, ChevronsUpDown, PencilLine } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { CAR_MODELS } from '@/lib/carModels'
import { trFold } from '@/lib/detectProvince'

/**
 * Araç modeli seçici (kullanıcı isteği, 2026-10-21: "araç model kısmında tüm
 * modeller olsun, onlar arasında seçim yapalım"). Marka başlıkları altında
 * modeller; yazınca marka ya da modele göre süzülür ("clio", "renault", "egea
 * cross"). Listede olmayan bir model yazılırsa "… olarak kullan" ile o metin seçilir.
 */
export function CarModelCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const q = trFold(search).trim()

  const groups = React.useMemo(() => {
    return Object.entries(CAR_MODELS)
      .sort(([a], [b]) => a.localeCompare(b, 'tr'))
      .map(([brand, models]) => {
        const brandHit = q && trFold(brand).includes(q)
        const list = !q || brandHit ? models : models.filter((m) => trFold(`${brand} ${m}`).includes(q) || trFold(m).includes(q))
        return { brand, models: list }
      })
      .filter((g) => g.models.length > 0)
  }, [q])

  const exact = groups.some((g) => g.models.some((m) => trFold(`${g.brand} ${m}`) === q || trFold(m) === q))

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('flex items-center gap-2 truncate', !value && 'text-muted-foreground')}>
            <Car className="size-4 text-muted-foreground" />
            {value || 'Marka / model seçin ya da yazın'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Marka ya da model ara… (ör. Clio, Egea)" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-80">
            <CommandEmpty>Listede yok — aşağıdan yazdığınızı kullanın</CommandEmpty>
            {search.trim() && !exact && (
              <CommandGroup>
                <CommandItem value={`custom:${search}`} onSelect={() => pick(search.trim())}>
                  <PencilLine className="size-4" /> "{search.trim()}" olarak kullan
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map((g) => (
              <CommandGroup key={g.brand} heading={g.brand}>
                {g.models.map((m) => {
                  const label = `${g.brand} ${m}`
                  return (
                    <CommandItem key={label} value={label} onSelect={() => pick(label)}>
                      <Check className={cn('size-4', trFold(value) === trFold(label) ? 'opacity-100' : 'opacity-0')} />
                      {m}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
