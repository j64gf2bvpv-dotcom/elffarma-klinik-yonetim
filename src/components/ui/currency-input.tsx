import * as React from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: unknown
  onChange: (value: number | undefined) => void
  suffix?: string
  placeholder?: string
  id?: string
  className?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

function formatDisplay(raw: string): string {
  const [intPart, decPart] = raw.split(',')
  const cleanInt = intPart.replace(/^0+(?=\d)/, '')
  const grouped = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart !== undefined ? `${grouped || '0'},${decPart}` : grouped
}

function toNumber(raw: string): number | undefined {
  if (!raw) return undefined
  const [intPart, decPart] = raw.split(',')
  const normalized = `${intPart || '0'}.${decPart ?? ''}`
  const n = Number.parseFloat(normalized)
  return Number.isNaN(n) ? undefined : n
}

function numberToRaw(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  const num = Number(value as number | string)
  if (Number.isNaN(num)) return ''
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace('.', ',')
}

export function CurrencyInput({ value, onChange, suffix = '₺', placeholder, id, className, onKeyDown }: CurrencyInputProps) {
  const [raw, setRaw] = React.useState<string>(() => numberToRaw(value))
  const [focused, setFocused] = React.useState(false)

  React.useEffect(() => {
    if (!focused) setRaw(numberToRaw(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let next = e.target.value.replace(/[^\d,]/g, '')
    const firstComma = next.indexOf(',')
    if (firstComma !== -1) {
      const intPart = next.slice(0, firstComma)
      const decPart = next.slice(firstComma + 1).replace(/,/g, '').slice(0, 2)
      next = `${intPart},${decPart}`
    }
    setRaw(next)
    onChange(toNumber(next))
  }

  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={formatDisplay(raw)}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}
