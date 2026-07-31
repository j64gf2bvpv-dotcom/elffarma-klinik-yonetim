import * as React from 'react'

let openState = false
const listeners = new Set<() => void>()

function setGlobalOpen(value: boolean) {
  openState = value
  listeners.forEach((listener) => listener())
}

/**
 * AI sohbet panelinin açık/kapalı durumu — TopBar'daki sabit AI ikonu ile
 * AIChatWidget panelinin kendisi arasında paylaşılan tek gerçek kaynak
 * (module-level pub-sub, useAIWidgetVisibility ile aynı desen). Prop
 * drilling veya Context olmadan iki farklı bileşenin aynı state'i okuyup
 * yazabilmesini sağlar.
 */
export function useAIChatOpen() {
  const [open, setOpenState] = React.useState(openState)

  React.useEffect(() => {
    const listener = () => setOpenState(openState)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const setOpen = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? (value as (prev: boolean) => boolean)(openState) : value
    setGlobalOpen(next)
  }, [])

  return [open, setOpen] as const
}
