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
