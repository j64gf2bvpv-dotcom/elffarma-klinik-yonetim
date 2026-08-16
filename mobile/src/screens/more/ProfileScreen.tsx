import * as React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Toast from 'react-native-toast-message'
import { UserRound, Camera } from 'lucide-react-native'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useUpdateStaff } from '@/features/staff/hooks'
import { uploadBase64Image } from '@/lib/uploadImage'

/**
 * Pazarlama görselindeki "Profil Bilgileri" — kullanıcının kendi staff
 * kaydını (ad, telefon, görev unvanı, fotoğraf) görüntüleyip düzenlediği
 * ekran. E-posta salt okunur (auth.users'tan geliyor, staff.email ayrı bir
 * alan ve burada değiştirilmesi oturum e-postasını değiştirmez — kafa
 * karışıklığı olmasın diye düzenlenebilir yapılmadı). Fotoğraf yükleme,
 * masaüstündeki "Profilim" ile aynı `profile-images` bucket'ını (public)
 * kullanıyor — bkz. lib/uploadImage.ts.
 */
export function ProfileScreen() {
  const theme = useTheme()
  const { staff } = useAuth()
  const updateStaff = useUpdateStaff()
  const [fullName, setFullName] = React.useState(staff?.full_name ?? '')
  const [phone, setPhone] = React.useState(staff?.phone ?? '')
  const [jobTitle, setJobTitle] = React.useState(staff?.job_title ?? '')
  const [dirty, setDirty] = React.useState(false)
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false)

  React.useEffect(() => {
    if (!dirty && staff) {
      setFullName(staff.full_name)
      setPhone(staff.phone ?? '')
      setJobTitle(staff.job_title ?? '')
    }
  }, [staff, dirty])

  if (!staff) return null

  async function onSave() {
    await updateStaff.mutateAsync({
      id: staff!.id,
      patch: { full_name: fullName.trim(), phone: phone.trim() || null, job_title: jobTitle.trim() || null },
    })
    setDirty(false)
  }

  async function onPickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri izni verilmedi' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (result.canceled || !result.assets[0]?.base64) return
    setUploadingPhoto(true)
    try {
      const publicUrl = await uploadBase64Image(
        'profile-images',
        `${staff!.id}-${Date.now()}.jpg`,
        result.assets[0].base64,
      )
      await updateStaff.mutateAsync({ id: staff!.id, patch: { avatar_url: publicUrl } })
    } catch {
      Toast.show({ type: 'error', text1: 'Fotoğraf yüklenemedi' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <Screen scroll style={{ gap: 16 }}>
      <ScreenHeader title="Profil Bilgileri" />

      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <Pressable onPress={onPickPhoto} disabled={uploadingPhoto} style={{ position: 'relative' }}>
          {staff.avatar_url ? (
            <Image source={{ uri: staff.avatar_url }} style={{ width: 84, height: 84, borderRadius: 42 }} />
          ) : (
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: theme.colors.primary + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserRound size={38} color={theme.colors.primary} />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.background,
            }}
          >
            <Camera size={13} color={theme.colors.primaryForeground} />
          </View>
        </Pressable>
        <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.lg, marginTop: 4 }}>
          {staff.full_name}
        </Text>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.sm }}>
          {staff.role === 'admin' ? 'Yönetici' : 'Satış Temsilcisi'}
        </Text>
      </View>

      <Card style={{ gap: 14 }}>
        <TextField
          label="Ad Soyad"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v)
            setDirty(true)
          }}
        />
        <TextField
          label="Görev Unvanı"
          value={jobTitle}
          onChangeText={(v) => {
            setJobTitle(v)
            setDirty(true)
          }}
          placeholder="Ör. Bölge Satış Temsilcisi"
        />
        <TextField
          label="Telefon"
          value={phone}
          onChangeText={(v) => {
            setPhone(v)
            setDirty(true)
          }}
          keyboardType="phone-pad"
        />
        <TextField label="E-posta" value={staff.email ?? ''} editable={false} />
        {dirty && (
          <Button onPress={onSave} loading={updateStaff.isPending}>
            Kaydet
          </Button>
        )}
      </Card>
    </Screen>
  )
}
