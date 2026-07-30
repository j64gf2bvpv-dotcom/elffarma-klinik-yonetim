import * as React from 'react'

const HIDDEN_KEY = 'ai_widget_hidden'
const listeners = new Set<() => void>()

function readHidden(): boolean {
  return localStorage.getItem(HIDDEN_KEY) === '1'
}

function writeHidden(value: boolean) {
  localStorage.setItem(HIDDEN_KEY, value ? '1' : '0')
  listeners.forEach((listener) => listener())
}

/**
 * AI Asistan simgesinin ana ekranda gösterilip gösterilmeyeceği — cihaza özel
 * bir tercih (localStorage), tüm personeli etkileyen paylaşılan bir ayar
 * değil (bkz. AIChatWidget'taki sürükle/gizle özelliği ve Ayarlar > Yapay
 * Zeka'daki geri açma anahtarı — ikisi de bu hook üzerinden senkron kalır).
 */
export function useAIWidgetVisibility() {
  const [hidden, setHiddenState] = React.useState(readHidden)

  React.useEffect(() => {
    const listener = () => setHiddenState(readHidden())
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const setHidden = React.useCallback((value: boolean) => writeHidden(value), [])

  return { hidden, setHidden }
}
