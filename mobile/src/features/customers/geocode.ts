// Doktor adresini Google Geocoding API ile enlem/boylama çevirip
// customers.latitude/longitude/geocoded_at'e önbelleğe alır (bkz.
// supabase/schema.sql "43. DOKTOR KONUM BİLGİSİ"). Anahtar yoksa (henüz
// mobile/.env'e eklenmediyse) sessizce null döner — Harita ekranı bu
// durumda "adres bulunamadı" değil "haritalar için anahtar eksik" gösterir.
import { supabase } from '@/lib/supabaseClient'
import type { Customer } from '@shared/types/database'

export function addressQueryFor(customer: Pick<Customer, 'address' | 'district' | 'province' | 'hospital_name'>): string | null {
  const parts = [customer.address, customer.district, customer.province].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join(', ')
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=tr&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.[0]) return null
  const location = data.results[0].geometry?.location
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') return null
  return { lat: location.lat, lng: location.lng }
}

/** Bir doktoru geocode edip sonucu customers'a yazar; adres yoksa veya bulunamazsa null döner. */
export async function geocodeAndCacheCustomer(customer: Customer): Promise<{ lat: number; lng: number } | null> {
  const query = addressQueryFor(customer)
  if (!query) return null
  const result = await geocodeAddress(query)
  if (!result) return null
  await supabase
    .from('customers')
    .update({ latitude: result.lat, longitude: result.lng, geocoded_at: new Date().toISOString() })
    .eq('id', customer.id)
  return result
}
