import { updateVehicle } from './api'

/**
 * Araç listesindeki küçük resim (kullanıcı isteği, 2026-11-19: "araçlara arabanın küçük resmini koy"). Resmi
 * olmayan araç için modelin Wikipedia sayfasındaki fotoğraf bir kez aranır ve araca kaydedilir.
 */
const tried = new Set<string>()

export async function fillCarPhoto(vehicle: { id: string; brand_model: string; photo_url?: string | null }): Promise<string | null> {
  if (vehicle.photo_url || tried.has(vehicle.id)) return null
  tried.add(vehicle.id)
  const model = vehicle.brand_model.replace(/\(.*?\)|\b(19|20)\d{2}\b/g, '').trim()
  if (!model) return null
  for (const lang of ['en', 'tr']) {
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(model.replace(/\s+/g, '_'))}`)
      if (!res.ok) continue
      const data = (await res.json()) as { type?: string; thumbnail?: { source?: string } }
      const src = data.type !== 'disambiguation' ? data.thumbnail?.source?.split('?')[0] : undefined
      if (src) {
        await updateVehicle(vehicle.id, { photo_url: src } as never)
        return src
      }
    } catch {
      // internet yoksa sessizce geç
    }
  }
  return null
}
