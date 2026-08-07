import * as React from 'react'
import { Linking, Text, View } from 'react-native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, Navigation } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers } from '@/features/customers/hooks'
import { geocodeAndCacheCustomer, addressQueryFor } from '@/features/customers/geocode'
import type { Customer } from '@shared/types/database'

// Türkiye'nin yaklaşık merkezi — hiç geocode edilmiş doktor yokken haritanın
// açılış konumu.
const TURKEY_REGION = { latitude: 39.0, longitude: 35.0, latitudeDelta: 8, longitudeDelta: 8 }

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * gocust referansındaki "Maps View" / "Plan your day" fikrinin ilk adımı —
 * gerçek rota optimizasyonu değil, doktorları haritada gösterip harici
 * harita uygulamasına ("Yol Tarifi") yönlendiren basit bir görünüm. Google
 * Maps API anahtarı ekli (mobile/.env, EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) —
 * anahtar sadece Maps SDK for Android + Geocoding API'ye kısıtlı.
 */
export function MapScreen() {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { data: customers = [] } = useCustomers('')
  const [geocoding, setGeocoding] = React.useState(false)

  const geocoded = React.useMemo(() => customers.filter((c) => c.latitude != null && c.longitude != null), [customers])
  const missing = React.useMemo(
    () => customers.filter((c) => c.latitude == null && c.longitude == null && addressQueryFor(c)),
    [customers],
  )

  async function geocodeMissing() {
    setGeocoding(true)
    try {
      for (const customer of missing) {
        await geocodeAndCacheCustomer(customer)
      }
      await queryClient.invalidateQueries({ queryKey: ['customers'] })
    } finally {
      setGeocoding(false)
    }
  }

  const initialRegion =
    geocoded.length > 0
      ? {
          latitude: Number(geocoded[0].latitude),
          longitude: Number(geocoded[0].longitude),
          latitudeDelta: 2,
          longitudeDelta: 2,
        }
      : TURKEY_REGION

  return (
    <Screen style={{ gap: 10 }}>
      <ScreenHeader title="Harita" subtitle={`${geocoded.length} doktor haritada`} />

      {missing.length > 0 && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MapPin size={16} color={theme.colors.warning} />
          <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }}>
            {missing.length} doktorun konumu henüz hesaplanmadı
          </Text>
          <Button size="sm" onPress={geocodeMissing} disabled={geocoding}>
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600', fontSize: theme.fontSizes.xs }}>
              {geocoding ? 'Hesaplanıyor...' : 'Hesapla'}
            </Text>
          </Button>
        </Card>
      )}

      <View style={{ flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <MapView provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={initialRegion}>
          {geocoded.map((customer: Customer) => (
            <Marker
              key={customer.id}
              coordinate={{ latitude: Number(customer.latitude), longitude: Number(customer.longitude) }}
              pinColor={theme.colors.primary}
            >
              <Callout
                onPress={() => Linking.openURL(directionsUrl(Number(customer.latitude), Number(customer.longitude)))}
              >
                <View style={{ padding: 4, maxWidth: 220, gap: 4 }}>
                  <Text style={{ fontWeight: '700' }}>{customer.full_name}</Text>
                  {customer.hospital_name && <Text style={{ fontSize: 12, color: '#555' }}>{customer.hospital_name}</Text>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Navigation size={12} color="#2563eb" />
                    <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600' }}>Yol Tarifi</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>
    </Screen>
  )
}
