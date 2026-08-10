// Haversine formülüyle iki koordinat arası düz hat (kuş uçuşu) mesafe (km).
// Yol/trafik mesafesi değil — "yakınımdaki doktorlar" filtresi ve mesafe
// etiketleri için yeterli bir yaklaşım (bkz. useNearbyDoctors.ts).
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

export const NEARBY_RADIUS_OPTIONS_KM = [5, 10, 25, 50] as const
