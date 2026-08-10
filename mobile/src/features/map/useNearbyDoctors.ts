import * as React from 'react'
import * as Location from 'expo-location'
import { haversineKm } from './nearby'
import type { Customer } from '@shared/types/database'

export interface NearbyResult {
  customer: Customer
  distanceKm: number
}

/**
 * "Yakınımdaki doktorlar" araması — MapScreen.tsx (native) ve MapScreen.web.tsx
 * (Leaflet) arasında paylaşılan konum/mesafe mantığı (expo-location'ın web
 * derlemesi de var, aynı API her iki platformda çalışıyor). Sadece zaten
 * geocode edilmiş (latitude/longitude dolu) doktorlar arasında arar.
 */
export function useNearbyDoctors(geocoded: Customer[]) {
  const [myLocation, setMyLocation] = React.useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = React.useState<number | null>(null)
  const [locating, setLocating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function locate(defaultRadiusKm: number) {
    setLocating(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Konum izni verilmedi')
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
      setRadiusKm((r) => r ?? defaultRadiusKm)
    } catch {
      setError('Konum alınamadı')
    } finally {
      setLocating(false)
    }
  }

  function clear() {
    setMyLocation(null)
    setRadiusKm(null)
    setError(null)
  }

  const withDistance = React.useMemo<NearbyResult[]>(() => {
    if (!myLocation) return []
    return geocoded
      .map((customer) => ({
        customer,
        distanceKm: haversineKm(myLocation, { lat: Number(customer.latitude), lng: Number(customer.longitude) }),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [geocoded, myLocation])

  const nearby = React.useMemo(
    () => (radiusKm != null ? withDistance.filter((r) => r.distanceKm <= radiusKm) : withDistance),
    [withDistance, radiusKm],
  )

  return { myLocation, radiusKm, setRadiusKm, locating, locate, clear, nearby, error }
}
