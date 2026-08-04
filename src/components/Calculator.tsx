import * as React from 'react'
import { Delete } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Operator = '+' | '-' | '×' | '÷'

function formatOperand(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 8 })
}

function applyOperator(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
  }
}

/** Basit dört işlem hesap makinesi — TopBar'daki hesap makinesi popover'ında kullanılır. */
export function Calculator() {
  const [display, setDisplay] = React.useState('0')
  const [stored, setStored] = React.useState<number | null>(null)
  const [operator, setOperator] = React.useState<Operator | null>(null)
  const [awaitingNext, setAwaitingNext] = React.useState(false)

  function inputDigit(digit: string) {
    if (awaitingNext) {
      setDisplay(digit)
      setAwaitingNext(false)
      return
    }
    setDisplay((prev) => (prev === '0' ? digit : prev + digit))
  }

  function inputDecimal() {
    if (awaitingNext) {
      setDisplay('0.')
      setAwaitingNext(false)
      return
    }
    setDisplay((prev) => (prev.includes('.') ? prev : `${prev}.`))
  }

  function clearAll() {
    setDisplay('0')
    setStored(null)
    setOperator(null)
    setAwaitingNext(false)
  }

  function backspace() {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'))
  }

  function chooseOperator(nextOp: Operator) {
    const current = Number(display)
    if (stored != null && operator && !awaitingNext) {
      const result = applyOperator(stored, current, operator)
      setStored(result)
      setDisplay(formatOperand(result))
    } else {
      setStored(current)
    }
    setOperator(nextOp)
    setAwaitingNext(true)
  }

  function equals() {
    if (stored == null || !operator) return
    const current = Number(display)
    const result = applyOperator(stored, current, operator)
    setDisplay(formatOperand(result))
    setStored(null)
    setOperator(null)
    setAwaitingNext(true)
  }

  const pad: (string | { label: React.ReactNode; onClick: () => void; className?: string })[] = [
    'C',
    { label: <Delete className="size-4" />, onClick: backspace },
    '÷',
    '×',
    '7',
    '8',
    '9',
    '-',
    '4',
    '5',
    '6',
    '+',
    '1',
    '2',
    '3',
    { label: '=', onClick: equals, className: 'row-span-2 h-auto' },
    { label: '0', onClick: () => inputDigit('0'), className: 'col-span-2' },
    '.',
  ]

  return (
    <div className="w-64">
      <div className="bg-muted mb-2 rounded-lg px-3 py-3 text-right">
        <p className="truncate text-2xl font-semibold tabular-nums">{display}</p>
      </div>
      <div className="grid grid-cols-4 grid-rows-4 gap-1.5">
        {pad.map((key, i) => {
          if (typeof key === 'object') {
            return (
              <Button
                key={i}
                type="button"
                variant="secondary"
                className={cn('h-10', key.className)}
                onClick={key.onClick}
              >
                {key.label}
              </Button>
            )
          }
          if (key === 'C') {
            return (
              <Button key={i} type="button" variant="outline" className="h-10 text-destructive" onClick={clearAll}>
                C
              </Button>
            )
          }
          if (key === '+' || key === '-' || key === '×' || key === '÷') {
            return (
              <Button
                key={i}
                type="button"
                variant={operator === key ? 'default' : 'outline'}
                className="h-10"
                onClick={() => chooseOperator(key)}
              >
                {key}
              </Button>
            )
          }
          if (key === '.') {
            return (
              <Button key={i} type="button" variant="outline" className="h-10" onClick={inputDecimal}>
                .
              </Button>
            )
          }
          return (
            <Button key={i} type="button" variant="ghost" className="h-10" onClick={() => inputDigit(key)}>
              {key}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
