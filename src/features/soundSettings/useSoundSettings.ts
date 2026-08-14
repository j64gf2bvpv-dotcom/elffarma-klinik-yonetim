import * as React from 'react'

export interface SoundSettings {
  keyboard: boolean
  notification: boolean
  music: boolean
  musicVolume: number
}

const STORAGE_KEY = 'elffarma_sound_settings'

const defaultSettings: SoundSettings = { keyboard: false, notification: false, music: false, musicVolume: 0.3 }

function readStored(): SoundSettings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

let listeners: (() => void)[] = []
let current = readStored()

function setCurrent(next: SoundSettings) {
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage kullanılamıyorsa (gizli mod vb.) ses ayarı sadece o oturum için kalır.
  }
  for (const l of listeners) l()
}

/**
 * Ses ayarları (klavye/bildirim/arka plan müziği) kişisel VE cihaza özel bir
 * tercih olduğu için sunucuya değil localStorage'a kaydediliyor — renk modu
 * gibi hesaba bağlı bir ayar değil, aynı hesapla farklı bilgisayarlarda farklı
 * olması normal.
 */
export function useSoundSettings() {
  const [settings, setSettings] = React.useState(current)

  React.useEffect(() => {
    const listener = () => setSettings(current)
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  const update = React.useCallback((patch: Partial<SoundSettings>) => {
    setCurrent({ ...current, ...patch })
  }, [])

  return { settings, update }
}
