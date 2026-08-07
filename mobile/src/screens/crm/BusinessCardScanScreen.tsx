import * as React from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Toast from 'react-native-toast-message'
import { Camera, Image as ImageIcon, ScanLine, Loader2 } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { useCreateCustomer } from '@/features/customers/hooks'
import { chatWithImage } from '@/features/ai/chat'
import { AIServiceError } from '@/features/ai/types'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'BusinessCardScan'>

const EXTRACTION_PROMPT =
  'Bu bir kartvizit fotoğrafı. İçindeki bilgileri SADECE şu JSON biçiminde döndür, başka hiçbir açıklama ekleme: ' +
  '{"full_name": "...", "phone": "...", "email": "...", "hospital_name": "..."}. ' +
  'Bir alan kartvizitte yoksa değerini boş string yap. Telefonu ülke koduyla (+90...) normalize et.'

interface ExtractedFields {
  full_name: string
  phone: string
  email: string
  hospital_name: string
}

function parseExtraction(raw: string): ExtractedFields {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI yanıtından JSON okunamadı')
  const parsed = JSON.parse(jsonMatch[0])
  return {
    full_name: typeof parsed.full_name === 'string' ? parsed.full_name : '',
    phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    email: typeof parsed.email === 'string' ? parsed.email : '',
    hospital_name: typeof parsed.hospital_name === 'string' ? parsed.hospital_name : '',
  }
}

/**
 * gocust referansındaki "Kartvizit Tarama" özelliğinin Elffarma karşılığı —
 * yeni bir OCR servisi yerine, uygulamanın zaten var olan AIService altyapısı
 * (Ayarlar > Yapay Zekâ'da seçili sağlayıcı, görsel destekliyorsa) kullanılıyor.
 * Ollama (yerel, varsayılan olabilecek görsel desteklemeyen sağlayıcı) seçiliyse
 * anlaşılır bir hata gösterir. Sonuç, minimal bir "Yeni Doktor" formuna
 * (ad+telefon zorunlu) dolduruluyor — tam Cari Kart formu Faz 2'de.
 */
export function BusinessCardScanScreen({ navigation }: Props) {
  const theme = useTheme()
  const createCustomerMutation = useCreateCustomer()
  const [imageUri, setImageUri] = React.useState<string | null>(null)
  const [imageBase64, setImageBase64] = React.useState<string | null>(null)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [fields, setFields] = React.useState<ExtractedFields | null>(null)

  async function pick(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Kamera/galeri izni verilmedi' })
      return
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 })
    if (result.canceled || !result.assets[0]) return
    setImageUri(result.assets[0].uri)
    setImageBase64(result.assets[0].base64 ?? null)
    setFields(null)
  }

  async function analyze() {
    if (!imageBase64) return
    setAnalyzing(true)
    try {
      const raw = await chatWithImage(imageBase64, 'image/jpeg', EXTRACTION_PROMPT)
      setFields(parseExtraction(raw))
    } catch (err) {
      const message = err instanceof AIServiceError ? err.message : err instanceof Error ? err.message : 'Bilinmeyen hata'
      Toast.show({ type: 'error', text1: 'Analiz edilemedi', text2: message })
    } finally {
      setAnalyzing(false)
    }
  }

  async function save() {
    if (!fields || !fields.full_name.trim() || !fields.phone.trim()) {
      Toast.show({ type: 'error', text1: 'Ad soyad ve telefon zorunlu' })
      return
    }
    await createCustomerMutation.mutateAsync({
      full_name: fields.full_name.trim(),
      phone: fields.phone.trim(),
      email: fields.email.trim() || null,
      hospital_name: fields.hospital_name.trim() || null,
    })
    Toast.show({ type: 'success', text1: 'Doktor eklendi' })
    navigation.goBack()
  }

  return (
    <Screen scroll style={{ gap: 14 }}>
      <ScreenHeader title="Kartvizit Tara" subtitle="Fotoğraftan yeni doktor ekle" />

      {!imageUri && (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
            Bir kartvizit fotoğrafı çekin veya galeriden seçin.
          </Text>
          <Button onPress={() => pick('camera')}>
            <Camera size={16} color={theme.colors.primaryForeground} />
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Kamerayla Çek</Text>
          </Button>
          <Button variant="outline" onPress={() => pick('library')}>
            <ImageIcon size={16} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Galeriden Seç</Text>
          </Button>
        </Card>
      )}

      {imageUri && (
        <Card style={{ gap: 10 }}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: theme.radius.md }} resizeMode="cover" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant="outline"
              onPress={() => {
                setImageUri(null)
                setImageBase64(null)
                setFields(null)
              }}
              style={{ flex: 1 }}
            >
              <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Değiştir</Text>
            </Button>
            <Button onPress={analyze} disabled={analyzing} style={{ flex: 1 }}>
              {analyzing ? (
                <ActivityIndicator size="small" color={theme.colors.primaryForeground} />
              ) : (
                <ScanLine size={16} color={theme.colors.primaryForeground} />
              )}
              <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>
                {analyzing ? 'Analiz ediliyor...' : 'Analiz Et'}
              </Text>
            </Button>
          </View>
        </Card>
      )}

      {fields && (
        <Card style={{ gap: 12 }}>
          <TextField
            label="Ad Soyad"
            value={fields.full_name}
            onChangeText={(v) => setFields({ ...fields, full_name: v })}
          />
          <TextField
            label="Telefon"
            value={fields.phone}
            onChangeText={(v) => setFields({ ...fields, phone: v })}
            keyboardType="phone-pad"
          />
          <TextField
            label="E-posta (opsiyonel)"
            value={fields.email}
            onChangeText={(v) => setFields({ ...fields, email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Hastane/Klinik (opsiyonel)"
            value={fields.hospital_name}
            onChangeText={(v) => setFields({ ...fields, hospital_name: v })}
          />
          <Button onPress={save} disabled={createCustomerMutation.isPending}>
            {createCustomerMutation.isPending && <Loader2 size={16} color={theme.colors.primaryForeground} />}
            <Text style={{ color: theme.colors.primaryForeground, fontWeight: '600' }}>Doktor Olarak Kaydet</Text>
          </Button>
        </Card>
      )}
    </Screen>
  )
}
