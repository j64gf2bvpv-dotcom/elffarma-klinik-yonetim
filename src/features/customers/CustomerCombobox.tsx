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
  const [formOpen, setFormOpen] = React.useState(false)
  const { data: customers = [] } = useCustomers(search)
  const selected = customers.find((c) => c.id === value)

  return (
    <>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary w-full justify-start gap-2"
                onClick={() => {
                  setOpen(false)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4" /> Yeni Doktor Ekle
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {/*
        CustomerForm'un burada, Popover'ın DIŞINDA, her zaman mount edilmiş
        durumda render edilmesi bilinçli — önceden Popover'ın İÇİNDE
        (PopoverContent'in çocuğu olarak) render ediliyordu, ve Radix Popover
        kapanınca içeriğini (formu barındıran component instance'ı dahil)
        DOM'dan tamamen kaldırıyordu. Kullanıcı "Yeni Doktor Ekle"ye tıklayıp
        (bu popover'ı kapatıyordu) isim yazmaya başladığında, popover'ın kapanış
        animasyonu bitince form component'i altından unmount ediliyor, girilen
        her şey sessizce kayboluyordu (kullanıcı isteği, 2026-08-26: "isim
        yazıyorum eklenmiyor"). Form artık dıştan (formOpen/setFormOpen)
        kontrol ediliyor, Popover'ın yaşam döngüsünden bağımsız.
      */}
      <CustomerForm open={formOpen} onOpenChange={setFormOpen} onCreated={(created) => onChange(created.id)} />
    </>
  )
}
