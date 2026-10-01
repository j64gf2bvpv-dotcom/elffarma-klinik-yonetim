import { createRegion } from './api'
import { trFold, type DetectedLocation } from '@/lib/detectProvince'
import type { Region } from '@/types/database'

/**
 * Algılanan il (ve varsa ilçe) için bölge kimliği döner; yoksa oluşturur —
 * il adıyla üst bölge, ilçe varsa onun altında alt bölge ("İstanbul /
 * Kadıköy"). Toplu işlemlerde aynı bölge tekrar tekrar oluşturulmasın diye
 * `regions` dizisi yerinde güncellenir (çağıran aynı diziyi paylaştırır).
 * Eşleştirme büyük/küçük harf ve Türkçe karakterden bağımsız.
 */
export async function ensureRegionFor(location: DetectedLocation, regions: Region[]): Promise<string> {
  const same = (a: string, b: string) => trFold(a).trim() === trFold(b).trim()

  let parent = regions.find((r) => !r.parent_region_id && same(r.name, location.province))
  if (!parent) {
    parent = await createRegion({ name: location.province, parent_region_id: null })
    regions.push(parent)
  }
  if (!location.district) return parent.id

  let child = regions.find((r) => r.parent_region_id === parent!.id && same(r.name, location.district!))
  if (!child) {
    child = await createRegion({ name: location.district, parent_region_id: parent.id })
    regions.push(child)
  }
  return child.id
}
