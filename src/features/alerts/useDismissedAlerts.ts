import * as React from 'react'

const STORAGE_KEY = 'elffarma-dismissed-alerts'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

export function useDismissedAlerts() {
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => loadDismissed())

  const dismiss = React.useCallback((key: string) => {
    setDismissed((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      saveDismissed(next)
      return next
    })
  }, [])

  const dismissMany = React.useCallback((keys: string[]) => {
    if (keys.length === 0) return
    setDismissed((prev) => {
      const next = new Set(prev)
      for (const key of keys) next.add(key)
      saveDismissed(next)
      return next
    })
  }, [])

  return { dismissed, dismiss, dismissMany }
}
