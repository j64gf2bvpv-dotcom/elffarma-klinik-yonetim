import * as React from 'react'
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useCustomers } from './hooks'
import { CustomerForm } from './CustomerForm'

interface CustomerComboboxProps {
  value: string | undefined
  onChange: (customerId: string) => void
  placeholder?: string
}

export function CustomerCombobox({ value, onChange, placeholder }: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const { data: customers = [] } = useCustomers(search)
  const selected = customers.find((c) => c.id === value)

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
            <User className="size-4 text-muted-foreground" />
            {selected ? selected.full_name : (placeholder ?? 'Doktor seçin')}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="İsim veya telefon ara..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Doktor bulunamadı</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onChange(customer.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn('size-4', value === customer.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <div>
                    <p>{customer.full_name}</p>
                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-1">
            <CustomerForm
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary w-full justify-start gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Plus className="size-4" /> Yeni Doktor Ekle
                </Button>
              }
              onCreated={(created) => onChange(created.id)}
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
