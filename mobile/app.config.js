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
      ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ? { config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } }
        : {}),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-sqlite', 'react-native-maps'],
  },
}
