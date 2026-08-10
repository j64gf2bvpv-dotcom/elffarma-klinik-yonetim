import * as React from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, Navigation, LocateFixed, X, ChevronRight } from 'lucide-react-native'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useCustomers } from '@/features/customers/hooks'
import { geocodeAndCacheCustomer, addressQueryFor } from '@/features/customers/geocode'
import { useNearbyDoctors } from '@/features/map/useNearbyDoctors'
import { NEARBY_RADIUS_OPTIONS_KM } from '@/features/map/nearby'
import type { Customer } from '@shared/types/database'
import type { MapStackParamList, MainTabParamList } from '@/navigation/types'

type Props = CompositeScreenProps<
  NativeStackScreenProps<MapStackParamList, 'Map'>,
  BottomTabScreenProps<MainTabParamList>
>

// Türkiye'nin yaklaşık merkezi — hiç geocode edilmiş doktor yokken haritanın
// açılış konumu.
const TURKEY_REGION = { latitude: 39.0, longitude: 35.0, latitudeDelta: 8, longitudeDelta: 8 }

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * Master talimat §13'teki Harita ekranı — doktorları haritada gösterip
 * harici harita uygulamasına ("Yol Tarifi") yönlendiren görünüm + gerçek
 * GPS/yarıçap bazlı "yakınımdaki doktorlar" araması (useNearbyDoctors.ts,
 * MapScreen.web.tsx ile paylaşılan mantık). Pin/liste'den "Doktoru Gör"
 * Doktorlar sekmesindeki DoctorDetail'e (kendi geri tuşu olan native-stack
 * header'ıyla) geçiş yapar — Harita'nın kendi tab-root ekranında header
 * gösterilmediği için bu, haritadan doktora bakıp geri dönebilmenin yolu.
 */
export function MapScreen({ navigation }: Props) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { data: customers = [] } = useCustomers('')
  const [geocoding, setGeocoding] = React.useState(false)

  const geocoded = React.useMemo(() => customers.filter((c) => c.latitude != null && c.longitude != null), [customers])
  const missing = React.useMemo(
    () => customers.filter((c) => c.latitude == null && c.longitude == null && addressQueryFor(c)),
    [customers],
  )
  const { myLocation, radiusKm, setRadiusKm, locating, locate, clear, nearby, error } = useNearbyDoctors(geocoded)

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

  function goToDoctor(customerId: string, customerName: string) {
    navigation.navigate('DoktorlarTab', { screen: 'DoctorDetail', params: { customerId, customerName } })
  }

  const displayed = myLocation && radiusKm != null ? nearby.map((n) => n.customer) : geocoded

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

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LocateFixed size={16} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Yakınımdaki Doktorlar</Text>
          {myLocation ? (
            <Pressable onPress={clear} hitSlop={8}>
              <X size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ) : (
            <Button size="sm" onPress={() => locate(10)} disabled={locating}>
              <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600', fontSize: theme.fontSizes.xs }}>
                {locating ? 'Aranıyor...' : 'Konumumu Bul'}
              </Text>
            </Button>
          )}
        </View>

        {error && <Text style={{ color: theme.colors.destructive, fontSize: theme.fontSizes.xs }}>{error}</Text>}

        {myLocation && (
          <>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {NEARBY_RADIUS_OPTIONS_KM.map((km) => (
                <Pressable key={km} onPress={() => setRadiusKm(km)} hitSlop={4}>
                  <Badge variant={radiusKm === km ? 'default' : 'outline'}>{`${km} km`}</Badge>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
              {nearby.length} doktor {radiusKm} km içinde
            </Text>
            {nearby.slice(0, 5).map(({ customer, distanceKm }) => (
              <View key={customer.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable
                  onPress={() => goToDoctor(customer.id, customer.full_name)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, flex: 1 }}
                >
                  <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.sm, flex: 1 }} numberOfLines={1}>
                    {customer.full_name}
                  </Text>
                  <Badge variant="secondary">{`${distanceKm.toFixed(1)} km`}</Badge>
                  <ChevronRight size={14} color={theme.colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL(directionsUrl(Number(customer.latitude), Number(customer.longitude)))}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Navigation size={14} color={theme.colors.primary} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </Card>

      <View style={{ flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <MapView provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation={!!myLocation}>
          {displayed.map((customer: Customer) => (
            <Marker
              key={customer.id}
              coordinate={{ latitude: Number(customer.latitude), longitude: Number(customer.longitude) }}
              pinColor={theme.colors.primary}
            >
              <Callout onPress={() => goToDoctor(customer.id, customer.full_name)}>
                <View style={{ padding: 4, maxWidth: 220, gap: 4 }}>
                  <Text style={{ fontWeight: '700' }}>{customer.full_name}</Text>
                  {customer.hospital_name && <Text style={{ fontSize: 12, color: '#555' }}>{customer.hospital_name}</Text>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <ChevronRight size={12} color="#2563eb" />
                    <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600' }}>Doktoru Gör</Text>
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
