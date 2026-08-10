import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { MapPin, LocateFixed, X, ChevronRight, Navigation } from 'lucide-react-native'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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
// açılış konumu (bkz. MapScreen.tsx, native tarafla aynı).
const TURKEY_CENTER: [number, number] = [39.0, 35.0]

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

function markerIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0z" fill="${color}"/>
      <circle cx="13" cy="13" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  })
}

/**
 * react-native-maps native-only bir modül (Google/Apple Maps SDK'sına
 * bağlı) — web platformunda render edilemiyor. Metro'nun platform-uzantı
 * çözümlemesi bu dosyayı (`.web.tsx`) sadece web derlemesinde, gerçek
 * MapScreen.tsx'i ise iOS/Android'de kullanır. Aynı gerçek doktor/konum
 * verisiyle (useCustomers + geocodeAndCacheCustomer) ve aynı "yakınımdaki
 * doktorlar" mantığıyla (useNearbyDoctors.ts, native tarafla paylaşılan)
 * API anahtarı gerektirmeyen OpenStreetMap/Leaflet haritası gösteriyor.
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

  const icon = React.useMemo(() => markerIcon(theme.colors.primary), [theme.colors.primary])
  const displayed = myLocation && radiusKm != null ? nearby.map((n) => n.customer) : geocoded
  const center: [number, number] =
    displayed.length > 0 ? [Number(displayed[0].latitude), Number(displayed[0].longitude)] : TURKEY_CENTER

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
                  onPress={() => window.open(directionsUrl(Number(customer.latitude), Number(customer.longitude)), '_blank')}
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

      {displayed.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 24,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <MapPin size={32} color={theme.colors.mutedForeground} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600', textAlign: 'center' }}>
            Henüz haritada gösterilecek konumu olan doktor yok
          </Text>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm, textAlign: 'center' }}>
            Yukarıdaki "Hesapla" butonuyla adresi kayıtlı doktorların konumunu hesaplayın.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 360, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          <MapContainer center={center} zoom={displayed.length > 1 ? 6 : 12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {displayed.map((customer: Customer) => (
              <Marker key={customer.id} position={[Number(customer.latitude), Number(customer.longitude)]} icon={icon}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{customer.full_name}</strong>
                    {customer.hospital_name && (
                      <div style={{ fontSize: 12, color: '#555' }}>{customer.hospital_name}</div>
                    )}
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          goToDoctor(customer.id, customer.full_name)
                        }}
                        style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Doktoru Gör →
                      </a>
                      <a
                        href={directionsUrl(Number(customer.latitude), Number(customer.longitude))}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#555', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Yol Tarifi
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </View>
      )}
    </Screen>
  )
}
