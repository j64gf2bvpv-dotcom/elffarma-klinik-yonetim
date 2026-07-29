import * as React from 'react'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useClinics } from './hooks'

interface ClinicComboboxProps {
  value: string | null | undefined
  onChange: (clinicId: string | null) => void
  placeholder?: string
}

export function ClinicCombobox({ value, onChange, placeholder }: ClinicComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { data: clinics = [] } = useClinics(search)
  const selected = clinics.find((c) => c.id === value)

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
            <Building2 className="size-4 text-muted-foreground" />
            {selected ? selected.name : (placeholder ?? 'Klinik seçin (opsiyonel)')}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Klinik ara..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Klinik bulunamadı</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <Check className={cn('size-4', !value ? 'opacity-100' : 'opacity-0')} />
                Belirtilmedi
              </CommandItem>
              {clinics.map((clinic) => (
                <CommandItem
                  key={clinic.id}
                  value={clinic.id}
                  onSelect={() => {
                    onChange(clinic.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', value === clinic.id ? 'opacity-100' : 'opacity-0')} />
                  {clinic.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
