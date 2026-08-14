import * as React from 'react'
import { toast } from 'sonner'
import { useSoundSettings } from './useSoundSettings'

/**
 * Arka plan müziği (klavye/bildirim seslerinin aksine) sentezlenemez —
 * gerçek bir ses dosyası gerekiyor. `public/audio/background.mp3` konumuna
 * kullanıcının kendi seçtiği (telif hakkı sorunu olmayan) bir mp3 dosyası
 * eklenmesi bekleniyor; dosya yoksa (404/decode hatası) sessizce başarısız
 * OLMUYOR — açık, tek seferlik bir uyarı gösterip anahtarı kapatıyor, aksi
 * halde kullanıcı "açtım ama çalmıyor" diye şaşırırdı.
 */
export function useBackgroundMusic() {
  const { settings, update } = useSoundSettings()
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/audio/background.mp3')
      audio.loop = true
      audioRef.current = audio
    }
    const audio = audioRef.current
    audio.volume = settings.musicVolume
  }, [settings.musicVolume])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (settings.music) {
      audio.play().catch(() => {
        toast.error('Arka plan müziği çalınamadı', {
          description: 'public/audio/background.mp3 konumuna bir müzik dosyası eklemeniz gerekiyor.',
        })
        update({ music: false })
      })
    } else {
      audio.pause()
    }
  }, [settings.music, update])

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])
}
