import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Cari Kart listesinde hücreye tıklayıp yerinde düzenleme (kullanıcı isteği,
 * 2026-10-01: "isimlerine, numaralarına, bölgelerine tıklandığında düzenleme
 * yapabilmeliyim"). Enter ya da dışarı tıklama kaydeder, Esc vazgeçer.
 * Satırın kendi tıklaması (satır seçimi) tetiklenmesin diye olaylar durdurulur.
 */
export function InlineTextCell({
  value,
  display,
  placeholder,
  onSave,
  inputType = 'text',
  className,
  title = 'Düzenlemek için tıklayın',
}: {
  value: string
  display?: React.ReactNode
  placeholder: string
  onSave: (next: string) => void
  inputType?: string
  className?: string
  title?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(value)

  function start(e: React.SyntheticEvent) {
    e.stopPropagation()
    setText(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const next = text.trim()
    if (next !== value.trim()) onSave(next)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={inputType}
        value={text}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setText(value)
            setEditing(false)
          }
        }}
        className="h-8 min-w-36"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      title={title}
      className={cn('-mx-1 max-w-full rounded px-1 py-0.5 text-left hover:bg-accent', className)}
    >
      {value ? (display ?? value) : <span className="text-muted-foreground/60">{placeholder}</span>}
    </button>
  )
}
