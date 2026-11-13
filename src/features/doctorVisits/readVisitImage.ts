import { ensureReadableImage } from '@/lib/ensureReadableImage'
import { fileToDataUrl } from '@/features/vehicles/registration'
import { boxesToLines, parseVisitLines, type ImageVisitRow } from './visitText'

export type { ImageVisitRow }

/**
 * Resimdeki ziyaret listesini okur (kullanıcı isteği, 2026-11-13: "içe aktar kısmında resimde ekleme
 * olsun, günü ve içeriği oradan okuyup eklesin"). İşletim sisteminin yazı tanıması (macOS Vision /
 * Windows OCR) kullanılır — yapay zekâ yok. Gün başlıkları ("Pazartesi", "13.11.2026", "13 Kasım")
 * altındaki doktorlar o güne yazılır; satırın içindeki tarih de o satırın günü olur.
 */
export async function readVisitImage(file: File, days: Date[], repName = ''): Promise<ImageVisitRow[]> {
  const ocr = window.electronAPI?.nativeOcr
  if (!ocr) throw new Error('Resimden okuma yalnızca masaüstü programında çalışır.')
  const readable = await ensureReadableImage(file)
  const boxes = await ocr(await fileToDataUrl(readable, 3000, 0.95))
  if (!boxes?.length) throw new Error('Resimde yazı bulunamadı.')
  return parseVisitLines(boxesToLines(boxes), days, repName)
}
