import * as React from 'react'

import { cn } from '@/lib/utils'
import { formatPhoneTyping } from '@/lib/personFormat'

// Telefon kutuları (type="tel" ya da adı/id'si telefon olan) yazarken "0532 123 45 67" biçimine girer
const isPhoneField = (type?: string, name?: string, id?: string) => type === 'tel' || /phone|telefon/i.test(`${name ?? ''} ${id ?? ''}`)

function Input({ className, type, onChange, ...props }: React.ComponentProps<'input'>) {
  const phone = isPhoneField(type, props.name, props.id)
  return (
    <input
      type={type}
      onChange={
        phone && onChange
          ? (e) => {
              const f = formatPhoneTyping(e.target.value)
              if (f !== e.target.value) e.target.value = f
              onChange(e)
            }
          : onChange
      }
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
