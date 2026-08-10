import * as React from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { UserRound, Bot, Info, Shield, LogOut, ChevronRight, ClipboardList, Camera } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Toast from 'react-native-toast-message'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/auth'
import { useStaffList, useUpdateStaff } from '@/features/staff/hooks'
import { useAppSetting } from '@/features/appSettings/hooks'
import { uploadBase64Image } from '@/lib/uploadImage'
import type { AISettings } from '@/features/ai/types'
import type { MoreStackParamList } from '@/navigation/types'

type Props = NativeStackScreenProps<MoreStackParamList, 'Settings'>

const roleLabels: Record<string, string> = {
  admin: 'Yönetici',
  staff: 'Personel',
}

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme()
  const { staff, signOut } = useAuth()
  const { data: staffList = [] } = useStaffList()
  const { data: aiSettings } = useAppSetting<AISettings>('ai_settings')
  const updateStaff = useUpdateStaff()
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false)
  const [phone, setPhone] = React.useState('')
  const [phoneDirty, setPhoneDirty] = React.useState(false)

  // useAuth()'un staff'ı oturum açılışında bir kez yüklenip cache'lenmiyor
  // (React state) — kendi profilini güncelledikten sonra anında yansısın
  // diye staffList'teki (useStaffList zaten invalidate ediliyor) kendi satırı
  // öncelikli kullanılıyor.
  const myStaff = staffList.find((s) => s.id === staff?.id) ?? staff

  React.useEffect(() => {
    if (!phoneDirty) setPhone(myStaff?.phone ?? '')
  }, [myStaff?.phone, phoneDirty])

  const provider = aiSettings?.provider ?? 'ollama'
  const model = aiSettings?.model ?? 'qwen2.5:3b'
  const baseUrl = aiSettings?.baseUrl ?? 'http://localhost:11434'

  async function onChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri izni verilmedi' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (result.canceled || !result.assets[0]?.base64 || !staff) return
    setUploadingPhoto(true)
    try {
      const url = await uploadBase64Image('profile-images', `staff/${staff.id}.jpg`, result.assets[0].base64)
      await updateStaff.mutateAsync({ id: staff.id, patch: { avatar_url: `${url}?t=${Date.now()}` } })
    } catch {
      Toast.show({ type: 'error', text1: 'Fotoğraf yüklenemedi' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function onSavePhone() {
    if (!staff) return
    await updateStaff.mutateAsync({ id: staff.id, patch: { phone: phone.trim() || null } })
    setPhoneDirty(false)
  }

  return (
    <Screen scroll style={{ gap: 12 }}>
      <ScreenHeader title="Ayarlar" />

      {/* Profilim */}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={onChangePhoto} disabled={uploadingPhoto}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: theme.colors.primary + '26',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {myStaff?.avatar_url ? (
                <Image source={{ uri: myStaff.avatar_url }} style={{ width: 56, height: 56 }} />
              ) : (
                <UserRound size={26} color={theme.colors.primary} />
              )}
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.card,
              }}
            >
              <Camera size={11} color={theme.colors.primaryForeground} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.foreground, fontWeight: '700', fontSize: theme.fontSizes.base }}>
              {myStaff?.full_name ?? '—'}
            </Text>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>
              {uploadingPhoto ? 'Fotoğraf yükleniyor...' : (roleLabels[myStaff?.role ?? 'staff'] ?? myStaff?.role)}
            </Text>
          </View>
          <Badge variant={myStaff?.role === 'admin' ? 'default' : 'secondary'}>
            {roleLabels[myStaff?.role ?? 'staff'] ?? myStaff?.role}
          </Badge>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TextField
            label="Telefon"
            value={phone}
            onChangeText={(v) => {
              setPhone(v)
              setPhoneDirty(true)
            }}
            placeholder="05XX XXX XX XX"
            keyboardType="phone-pad"
            style={{ flex: 1 }}
          />
          {phoneDirty && (
            <Button size="sm" onPress={onSavePhone} loading={updateStaff.isPending}>
              Kaydet
            </Button>
          )}
        </View>
      </Card>

      {/* AI Ayarları */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Bot size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Yapay Zeka</Text>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sağlayıcı</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>{provider}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Model</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>{model}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sunucu</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }} numberOfLines={1}>{baseUrl}</Text>
          </View>
        </View>
      </Card>

      {/* Personel Listesi (admin) */}
      {staff?.role === 'admin' && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Shield size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Personel ({staffList.length})</Text>
          </View>
          <View style={{ gap: 8 }}>
            {staffList.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.foreground, fontWeight: '500' }}>{s.full_name}</Text>
                  {s.phone && <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>{s.phone}</Text>}
                </View>
                <Pressable
                  onPress={() =>
                    updateStaff.mutate({
                      id: s.id,
                      patch: { role: s.role === 'admin' ? 'staff' : 'admin' },
                    })
                  }
                  hitSlop={8}
                >
                  <Badge variant={s.role === 'admin' ? 'default' : 'secondary'}>
                    {roleLabels[s.role] ?? s.role}
                  </Badge>
                </Pressable>
                <Pressable
                  onPress={() => updateStaff.mutate({ id: s.id, patch: { is_active: !s.is_active } })}
                  hitSlop={8}
                >
                  <Badge variant={s.is_active ? 'success' : 'destructive'}>
                    {s.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Audit Log (admin) */}
      {staff?.role === 'admin' && (
        <Pressable
          onPress={() => navigation.navigate('AuditLogs')}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.foreground, fontWeight: '600', flex: 1 }}>Audit Log</Text>
              <ChevronRight size={18} color={theme.colors.mutedForeground} />
            </View>
          </Card>
        </Pressable>
      )}

      {/* Uygulama Bilgisi */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Info size={18} color={theme.colors.mutedForeground} />
          <Text style={{ color: theme.colors.foreground, fontWeight: '600' }}>Uygulama</Text>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Sürüm</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Elffarma Mobil v1.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSizes.xs }}>Tema</Text>
            <Text style={{ color: theme.colors.foreground, fontSize: theme.fontSizes.xs, fontWeight: '600' }}>Black / Gold (Premium)</Text>
          </View>
        </View>
      </Card>

      {/* Çıkış */}
      <Pressable
        onPress={signOut}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 16,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <LogOut size={18} color={theme.colors.destructive} />
        <Text style={{ color: theme.colors.destructive, fontWeight: '600', flex: 1 }}>Çıkış Yap</Text>
        <ChevronRight size={18} color={theme.colors.mutedForeground} />
      </Pressable>
    </Screen>
  )
}
