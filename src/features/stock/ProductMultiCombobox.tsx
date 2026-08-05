import * as React from 'react'
import { ChevronsUpDown, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useProducts } from './hooks'

interface ProductMultiComboboxProps {
  /** Boş dizi = filtre yok (tüm ürünler dahil). */
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

/** Tik kutulu, aranabilir çoklu ürün seçici — Stok Kartı "Tüm Ürünler" raporunda hangi ürünlerin dökümde görüneceğini seçmek için. */
export function ProductMultiCombobox({ value, onChange, placeholder }: ProductMultiComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { data: products = [] } = useProducts(search)
  const selectedSet = React.useMemo(() => new Set(value), [value])

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const label =
    value.length === 0 ? (placeholder ?? 'Ürün seçin (tümü)') : `${value.length} ürün seçili`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <Package className="size-4 text-muted-foreground" />
            {label}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ürün ara..." value={search} onValueChange={setSearch} />
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onChange(products.map((p) => p.id))}
            >
              Tümünü Seç
            </button>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >
              Temizle
            </button>
          </div>
          <CommandList>
            <CommandEmpty>Ürün bulunamadı</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem key={product.id} value={product.id} onSelect={() => toggle(product.id)}>
                  <Checkbox checked={selectedSet.has(product.id)} onCheckedChange={() => toggle(product.id)} />
                  <div className="flex-1">
                    <p>{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stok: {product.current_quantity} {product.unit}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
