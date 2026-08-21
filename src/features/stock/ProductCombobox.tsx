import * as React from 'react'
import { Check, ChevronsUpDown, Package } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useProducts } from './hooks'
import type { Product } from '@/types/database'

interface ProductComboboxProps {
  value: string | undefined
  onChange: (product: Product) => void
  placeholder?: string
  /** Ürün seçilip popover kapandıktan hemen sonra çağrılır — formda bir sonraki alana (ör. Miktar) odağı taşımak için kullanılır. */
  onSelectComplete?: () => void
}

export function ProductCombobox({ value, onChange, placeholder, onSelectComplete }: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { data: products = [] } = useProducts(search)
  const selected = products.find((p) => p.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Package className="size-4 text-muted-foreground" />
            {selected ? selected.name : (placeholder ?? 'Ürün seçin')}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ürün ara..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Ürün bulunamadı</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onChange(product)
                    setOpen(false)
                    if (onSelectComplete) {
                      // Popover kapanışı Radix'te bir sonraki tick'te odağı
                      // tetikleyiciye (Button) geri döndürüyor — bizim odak
                      // taşımamızın ondan SONRA çalışması gerekiyor, aksi
                      // halde Radix'in kendi odak yönetimi bizimkini eziyor.
                      requestAnimationFrame(() => onSelectComplete())
                    }
                  }}
                >
                  <Check className={cn('size-4', value === product.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1">
                    <p>{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.unit_price
                        ? Number(product.unit_price).toLocaleString('tr-TR', {
                            style: 'currency',
                            currency: 'TRY',
                          })
                        : 'Fiyat yok'}
                      {' · '}
                      Stok: {product.current_quantity > 0 ? `${product.current_quantity} ${product.unit}` : '—'}
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
