// app.json'dan app.config.js'e dönüştürüldü — Android'deki Google Maps API
// anahtarını build zamanında .env'den (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
// enjekte edebilmek için (statik app.json bunu yapamaz). Anahtar yoksa
// (henüz .env'e eklenmediyse) android.config.googleMaps hiç eklenmez —
// react-native-maps o zaman Android'de haritayı boş/hata gösterir, iOS
// (Apple Maps, anahtarsız) etkilenmez.
module.exports = {
  expo: {
    name: 'Elffarma Paket Programı',
    slug: 'elffarma-paket-programi',
    scheme: 'elffarmapaket',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.elffarma.paketprogrami',
      buildNumber: '4',
      infoPlist: {
  NSLocationWhenInUseUsageDescription:
    'Doktor ziyaretlerinde check-in/check-out konumunu ve haritadaki yakınımdaki doktorlar özelliğini kullanabilmek için konumunuza ihtiyaç duyuyoruz.',
  ITSAppUsesNonExemptEncryption: false,
},
      // MapScreen.tsx PROVIDER_GOOGLE'ı zorluyor (Android'le tutarlı pin/
      // callout görünümü için) — bu anahtar olmadan react-native-maps
      // iOS'ta da boş harita gösterir, Android'deki googleMaps.apiKey ile
      // aynı .env değeri.
      ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ? { config: { googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } }
        : {}),
    },
    android: {
      package: 'com.elffarma.paketprogrami',
      adaptiveIcon: {
        backgroundColor: '#0D1117',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
      ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } }
        : {}),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-sqlite',
      'react-native-maps',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Doktor ziyaretlerinde check-in/check-out konumunu ve haritadaki yakınımdaki doktorlar özelliğini kullanabilmek için konumunuza ihtiyaç duyuyoruz.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
        },
      ],
      'expo-sharing',
       ],
    extra: {
      eas: {
        projectId: 'c37a87a2-ab70-4000-a503-bbaef99bfc71',
      },
      // EXPO_PUBLIC_* değişkenlerinin Metro'nun statik inline transformu
      // native'de sorunsuz çalışıyor ama web hedefinde process.env.EXPO_PUBLIC_*
      // çalışma zamanında undefined kalabiliyor (SDK 57'de gözlemlendi,
      // 2026-08-16) — expo-constants üzerinden okunan bu kopya, platformdan
      // bağımsız güvenilir bir yedek olarak supabaseClient.ts'te kullanılıyor.
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null,
      clinicName: process.env.EXPO_PUBLIC_CLINIC_NAME ?? null,
    },
  },
}