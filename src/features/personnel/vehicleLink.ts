import type { Personnel } from '@/types/database'
import { vehicleUserName, type VehicleWithRelations } from '@/features/vehicles/api'

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()

/**
 * Personele verilmiş araçlar (Araçlar bölümündeki "kullanan kişi" / bağlı satış temsilcisi adından). Araçta çoğu zaman
 * yalnız ad yazılı ("Furkan"); ad başka bir personelde de geçiyorsa yanlış eşleşmesin diye o araç kimseye bağlanmaz.
 */
export function vehiclesOfPerson(person: Personnel, people: Personnel[], vehicles: VehicleWithRelations[]): VehicleWithRelations[] {
  const matches = (p: Personnel, user: string) => {
    const full = fold(p.full_name)
    const u = fold(user)
    return full === u || full.startsWith(u + ' ') || ` ${full} `.includes(` ${u} `)
  }
  return vehicles.filter((v) => {
    const user = vehicleUserName(v)
    if (!user || !matches(person, user)) return false
    return people.filter((p) => matches(p, user)).length === 1
  })
}

/** Ad ("Furkan" ya da "Furkan Şahin") ile tek bir personeli eşleştirir; aynı ad birden fazla kişide geçiyorsa eşleşme yok */
export function personOfName(name: string | null | undefined, people: Personnel[]): Personnel | undefined {
  if (!name?.trim()) return undefined
  const u = fold(name)
  const hits = people.filter((p) => {
    const full = fold(p.full_name)
    return full === u || full.startsWith(u + ' ') || ` ${full} `.includes(` ${u} `)
  })
  return hits.length === 1 ? hits[0] : undefined
}
