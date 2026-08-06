import * as React from 'react'
import { toast } from 'sonner'
import { useAIService } from './useAIService'

let hasCheckedThisSession = false

/**
 * Uygulama açılışında (bir kez, oturum başına) yapılandırılan AI sağlayıcısına
 * bağlanmayı dener. Ollama varsayılan olduğu ve genelde yerelde çalıştığı için
 * bu kontrol bilgilendirici bir uyarıdır — hiçbir ekranı engellemez, sadece
 * "Ollama çalışmıyor" / "model yüklü değil" gibi durumları tek bir toast ile bildirir.
 */
export function useAIStartupCheck() {
  const aiService = useAIService()

  React.useEffect(() => {
    if (hasCheckedThisSession) return
    hasCheckedThisSession = true

    const timer = setTimeout(async () => {
      const result = await aiService.testConnection()
      if (!result.ok) {
        toast.warning('AI sağlayıcısına bağlanılamadı', {
          description: `${result.message} (Ayarlar > Yapay Zeka'dan kontrol edebilirsiniz.)`,
        })
      } else if (result.modelAvailable === false) {
        toast.warning('AI modeli yüklü değil', { description: result.message })
      }
    }, 1500)

    return () => clearTimeout(timer)
    // Sadece uygulama başına bir kez çalışsın — ayarlar değiştiğinde tekrar
    // tetiklenmesi gerekmiyor (kullanıcı zaten Ayarlar ekranındaki "Test Et"
    // düğmesiyle anlık kontrol edebilir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
